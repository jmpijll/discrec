use anyhow::{Context as AnyhowContext, Result};
use serenity::all::{ChannelId, ChannelType, GatewayIntents, GuildId};
use serenity::async_trait;
use serenity::client::{Client, Context, EventHandler};
use serenity::model::gateway::Ready;
use songbird::{CoreEvent, SerenityInit, Songbird};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use tokio::sync::{Mutex as TokioMutex, RwLock};

use super::receiver::{ReceiverState, VoiceHandler};
use crate::audio::encoder::AudioFormat;

#[derive(serde::Serialize, Clone, Debug)]
pub struct GuildInfo {
    pub id: String,
    pub name: String,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct VoiceChannelInfo {
    pub id: String,
    pub name: String,
    pub guild_id: String,
}

struct ReadyNotifier {
    ctx_store: Arc<RwLock<Option<Context>>>,
    ready_flag: Arc<AtomicBool>,
}

#[async_trait]
impl EventHandler for ReadyNotifier {
    async fn ready(&self, ctx: Context, ready: Ready) {
        log::info!("Discord bot connected as {}", ready.user.name);
        *self.ctx_store.write().await = Some(ctx);
        self.ready_flag.store(true, Ordering::SeqCst);
    }
}

pub struct DiscordBot {
    ctx_store: Arc<RwLock<Option<Context>>>,
    songbird: Option<Arc<Songbird>>,
    ready_flag: Arc<AtomicBool>,
    receiver_state: Arc<TokioMutex<Option<Arc<ReceiverState>>>>,
    is_recording: Arc<AtomicBool>,
    peak_level_bits: Arc<AtomicU32>,
    current_guild: TokioMutex<Option<GuildId>>,
}

impl DiscordBot {
    pub fn new() -> Self {
        Self {
            ctx_store: Arc::new(RwLock::new(None)),
            songbird: None,
            ready_flag: Arc::new(AtomicBool::new(false)),
            receiver_state: Arc::new(TokioMutex::new(None)),
            is_recording: Arc::new(AtomicBool::new(false)),
            peak_level_bits: Arc::new(AtomicU32::new(0)),
            current_guild: TokioMutex::new(None),
        }
    }

    pub fn is_connected(&self) -> bool {
        self.ready_flag.load(Ordering::SeqCst)
    }

    pub fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::Relaxed)
    }

    pub fn peak_level(&self) -> f32 {
        f32::from_bits(self.peak_level_bits.load(Ordering::Relaxed))
    }

    pub async fn connect(&mut self, token: &str) -> Result<()> {
        if self.is_connected() {
            anyhow::bail!("Already connected to Discord");
        }

        self.ready_flag.store(false, Ordering::SeqCst);
        *self.ctx_store.write().await = None;

        let intents = GatewayIntents::non_privileged() | GatewayIntents::GUILD_VOICE_STATES;

        let handler = ReadyNotifier {
            ctx_store: Arc::clone(&self.ctx_store),
            ready_flag: Arc::clone(&self.ready_flag),
        };

        let songbird = Songbird::serenity();
        let songbird_ref = Arc::clone(&songbird);

        let mut client = Client::builder(token, intents)
            .event_handler(handler)
            .register_songbird_with(songbird)
            .await
            .context("Failed to create Discord client")?;

        tokio::spawn(async move {
            if let Err(e) = client.start().await {
                log::error!("Discord client error: {:?}", e);
            }
        });

        // Wait for ready (up to 15 seconds)
        for _ in 0..150 {
            if self.ready_flag.load(Ordering::SeqCst) {
                break;
            }
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }

        if !self.ready_flag.load(Ordering::SeqCst) {
            anyhow::bail!("Timed out waiting for Discord bot to connect");
        }

        self.songbird = Some(songbird_ref);
        log::info!("Discord bot connected successfully");
        Ok(())
    }

    pub async fn disconnect(&mut self) {
        self.ready_flag.store(false, Ordering::SeqCst);
        self.songbird = None;
        *self.ctx_store.write().await = None;
        log::info!("Discord bot disconnected");
    }

    pub async fn list_guilds(&self) -> Result<Vec<GuildInfo>> {
        let ctx_guard = self.ctx_store.read().await;
        let ctx = ctx_guard.as_ref().context("Not connected to Discord")?;

        let guilds: Vec<GuildInfo> = ctx
            .cache
            .guilds()
            .iter()
            .filter_map(|gid| {
                ctx.cache.guild(*gid).map(|g| GuildInfo {
                    id: gid.to_string(),
                    name: g.name.clone(),
                })
            })
            .collect();

        Ok(guilds)
    }

    pub async fn list_voice_channels(&self, guild_id: u64) -> Result<Vec<VoiceChannelInfo>> {
        let ctx_guard = self.ctx_store.read().await;
        let ctx = ctx_guard.as_ref().context("Not connected to Discord")?;

        let gid = GuildId::new(guild_id);
        let channels = gid
            .channels(&ctx.http)
            .await
            .context("Failed to fetch channels")?;

        let voice_channels: Vec<VoiceChannelInfo> = channels
            .into_values()
            .filter(|ch| ch.kind == ChannelType::Voice)
            .map(|ch| VoiceChannelInfo {
                id: ch.id.to_string(),
                name: ch.name.clone(),
                guild_id: guild_id.to_string(),
            })
            .collect();

        Ok(voice_channels)
    }

    pub async fn start_recording(
        &self,
        guild_id: u64,
        channel_id: u64,
        output_dir: &str,
        format: AudioFormat,
        notify: bool,
    ) -> Result<()> {
        if self.is_recording() {
            anyhow::bail!("Already recording");
        }

        let songbird = self.songbird.as_ref().context("Not connected to Discord")?;

        let gid = GuildId::new(guild_id);
        let cid = ChannelId::new(channel_id);

        let handler_lock = songbird
            .join(gid, cid)
            .await
            .context("Failed to join voice channel")?;

        // Create shared receiver state
        let recv_state = ReceiverState::new(
            output_dir,
            format,
            Arc::clone(&self.is_recording),
            Arc::clone(&self.peak_level_bits),
        );

        // Register event handlers (cloned from same Arc)
        {
            let mut handler = handler_lock.lock().await;
            handler.add_global_event(
                CoreEvent::SpeakingStateUpdate.into(),
                VoiceHandler::new(Arc::clone(&recv_state)),
            );
            handler.add_global_event(
                CoreEvent::VoiceTick.into(),
                VoiceHandler::new(Arc::clone(&recv_state)),
            );
        }

        // Store receiver state for finalization later
        *self.receiver_state.lock().await = Some(recv_state);
        self.is_recording.store(true, Ordering::Relaxed);
        *self.current_guild.lock().await = Some(gid);

        log::info!(
            "Recording started in guild {} channel {}",
            guild_id,
            channel_id
        );

        // Send notification to the voice channel's text chat
        if notify {
            let ctx_guard = self.ctx_store.read().await;
            if let Some(ctx) = ctx_guard.as_ref() {
                match cid.say(&ctx.http, "🔴 Recording started by DiscRec").await {
                    Ok(_) => log::info!("Sent recording notification to channel"),
                    Err(e) => log::warn!("Failed to send recording notification: {}", e),
                }
            }
        }

        Ok(())
    }

    pub async fn get_channel_member_count(&self, guild_id: u64, channel_id: u64) -> Result<usize> {
        let ctx_guard = self.ctx_store.read().await;
        let ctx = ctx_guard.as_ref().context("Not connected to Discord")?;

        let gid = GuildId::new(guild_id);
        let cid = ChannelId::new(channel_id);

        let count = ctx
            .cache
            .guild(gid)
            .map(|guild| {
                guild
                    .voice_states
                    .values()
                    .filter(|vs| vs.channel_id == Some(cid))
                    .count()
            })
            .unwrap_or(0);

        Ok(count)
    }

    pub async fn stop_recording(&self) -> Result<Vec<String>> {
        if !self.is_recording() {
            return Ok(Vec::new());
        }

        self.is_recording.store(false, Ordering::Relaxed);
        self.peak_level_bits
            .store(0f32.to_bits(), Ordering::Relaxed);

        // Leave the voice channel
        if let Some(songbird) = &self.songbird {
            if let Some(gid) = self.current_guild.lock().await.take() {
                let _ = songbird.leave(gid).await;
                log::info!("Left voice channel in guild {}", gid);
            }
        }

        // Finalize encoders
        let recv = self.receiver_state.lock().await.take();
        if let Some(state) = recv {
            return state.finalize_all();
        }

        Ok(Vec::new())
    }
}

// Token management via OS keyring
const KEYRING_SERVICE: &str = "com.discrec.app";
const KEYRING_USER: &str = "discord_bot_token";

pub fn save_token(token: &str) -> Result<()> {
    let entry =
        keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).context("Failed to access keyring")?;
    entry
        .set_password(token)
        .context("Failed to save token to keyring")?;
    log::info!("Bot token saved to OS keyring");
    Ok(())
}

pub fn load_token() -> Result<Option<String>> {
    let entry =
        keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).context("Failed to access keyring")?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(anyhow::anyhow!("Failed to load token: {}", e)),
    }
}

pub fn delete_token() -> Result<()> {
    let entry =
        keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).context("Failed to access keyring")?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(anyhow::anyhow!("Failed to delete token: {}", e)),
    }
}
