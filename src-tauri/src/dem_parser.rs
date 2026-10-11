//! # DEM Parser Module
//!
//! Parses Deadlock Source 2 replay files (`.dem`) using the `boon-deadlock` crate.
//! Extracts match data equivalent to the Deadlock Web API:
//! heroes, teams, result, duration, lane assignments, and net worth at 12 minutes (for lane outcome).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

const STEAM_ID_BASE: u64 = 76561197960265728;

/// Result of parsing a .dem replay file.
/// Mirrors the TypeScript `DemParseResult` interface.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DemParseResult {
    pub match_id: u64,
    pub duration_seconds: u32,
    pub date_iso: String,
    pub my_hero_id: u32,
    /// 2 = Hidden King, 3 = Archmother
    pub my_team: u32,
    /// 5 hero IDs (team allies, excluding the player)
    pub allies: Vec<u32>,
    /// 6 hero IDs (enemy team)
    pub enemies: Vec<u32>,
    /// 2 = Hidden King won, 3 = Archmother won, 0 = unknown/cancelled
    pub winning_team: u32,
    /// Lane number: 1=Yellow, 4=Blue, 6=Green
    pub lane: Option<u32>,
    pub lane_ally_id: Option<u32>,
    pub lane_opponents: Vec<u32>,
    pub player_slot: Option<u32>,
    /// Cumulative souls (player + lane ally) at T≈720s
    pub my_lane_souls_at720: Option<u32>,
    /// Cumulative souls (lane enemies) at T≈720s
    pub enemy_lane_souls_at720: Option<u32>,
    /// Time (in seconds) when player's lane guardian was destroyed
    pub my_guardian_destroyed_at: Option<f32>,
    /// Time (in seconds) when enemy lane guardian was destroyed
    pub enemy_guardian_destroyed_at: Option<f32>,
    /// Total players found (sanity check, expected 12)
    pub player_count: u32,
}

#[derive(Debug, Clone, Default)]
struct PlayerInfo {
    account_id: u32,
    hero_id: u32,
    team_num: u32,
    start_lane: u32,
    player_slot: Option<u32>,
}

/// Parses a Deadlock .dem replay file and extracts match data.
pub fn parse_dem_file(path: &str, my_account_id: u32, match_id: u64) -> Result<DemParseResult, String> {
    let parser = boon::Parser::from_file(Path::new(path))
        .map_err(|e| format!("Failed to open replay file: {e}"))?;

    parser
        .verify()
        .map_err(|e| format!("Invalid or corrupted replay file: {e}"))?;

    let file_info = parser
        .file_info()
        .map_err(|e| format!("Failed to read replay metadata: {e}"))?;

    let duration_seconds = file_info.playback_time.map(|t| t as u32).unwrap_or(0);
    let playback_ticks = file_info.playback_ticks.unwrap_or(0);
    let tick_interval: f32 = match (file_info.playback_time, file_info.playback_ticks) {
        (Some(time), Some(ticks)) if ticks > 0 => time / ticks as f32,
        _ => 1.0 / 64.0,
    };

    // Extract file date as ISO string (taking the oldest between modified and created to capture true match time)
    let date_iso = std::fs::metadata(path)
        .ok()
        .and_then(|m| {
            let mod_time = m.modified().ok();
            let cre_time = m.created().ok();
            let best_time = match (mod_time, cre_time) {
                (Some(mt), Some(ct)) => Some(mt.min(ct)),
                (Some(mt), None) => Some(mt),
                (None, Some(ct)) => Some(ct),
                (None, None) => None,
            };
            let time = best_time?;
            let dur = time.duration_since(std::time::UNIX_EPOCH).ok()?;
            let secs = dur.as_secs() as i64;
            // Simple ISO-8601 formatting YYYY-MM-DDTHH:MM:SSZ
            chrono_approx_iso(secs)
        })
        .unwrap_or_default();

    // ── 1. Read early tick (~tick 1000) for players, teams, heroes, lanes ───────
    let tick_early = 1000.min(playback_ticks.max(1) - 1);
    let ctx_early = parser
        .parse_to_tick(tick_early)
        .map_err(|e| format!("Failed to read match start tick: {e}"))?;

    let ser_ctrl = ctx_early
        .serializers()
        .get("CCitadelPlayerController")
        .ok_or_else(|| "Serializer CCitadelPlayerController not found in replay.".to_string())?;

    let mut players: HashMap<u32, PlayerInfo> = HashMap::new(); // account_id -> PlayerInfo

    for (_, ent) in ctx_early.entities().iter() {
        if ent.class_name.as_ref() != "CCitadelPlayerController" {
            continue;
        }

        let team_num = ent
            .get_by_name("m_iTeamNum", ser_ctrl)
            .map(extract_u32)
            .unwrap_or(0);

        // Only competing teams (2 = Hidden King, 3 = Archmother)
        if team_num != 2 && team_num != 3 {
            continue;
        }

        let steam_id = ent
            .get_by_name("m_steamID", ser_ctrl)
            .map(extract_u64)
            .unwrap_or(0);

        if steam_id == 0 {
            continue;
        }

        let account_id = if steam_id > STEAM_ID_BASE {
            (steam_id - STEAM_ID_BASE) as u32
        } else {
            steam_id as u32
        };

        let hero_id = ent
            .get_by_name("m_PlayerDataGlobal.m_nHeroID", ser_ctrl)
            .map(extract_u32)
            .unwrap_or(0);

        let start_lane = ent
            .get_by_name("m_nAssignedLane", ser_ctrl)
            .map(extract_u32)
            .unwrap_or(0);

        let player_slot = ent
            .get_by_name("m_nPlayerSlot", ser_ctrl)
            .or_else(|| ent.get_by_name("m_iPlayerID", ser_ctrl))
            .map(extract_u32);

        players.insert(
            account_id,
            PlayerInfo {
                account_id,
                hero_id,
                team_num,
                start_lane,
                player_slot,
            },
        );
    }

    if players.is_empty() {
        return Err("No players found in replay file.".to_string());
    }

    // Find the requested player
    let me = players
        .get(&my_account_id)
        .cloned()
        .ok_or_else(|| {
            let found_accounts: Vec<u32> = players.keys().copied().collect();
            format!(
                "Account ID {} not found in this replay ({} players detected: {:?}).",
                my_account_id,
                players.len(),
                found_accounts
            )
        })?;

    let my_team = me.team_num;
    let my_lane = me.start_lane;

    let mut allies_players: Vec<&PlayerInfo> = players
        .values()
        .filter(|p| p.team_num == my_team && p.account_id != my_account_id && p.hero_id != 0)
        .collect();
    allies_players.sort_by_key(|p| p.start_lane);
    let allies: Vec<u32> = allies_players.iter().map(|p| p.hero_id).collect();

    let mut enemies_players: Vec<&PlayerInfo> = players
        .values()
        .filter(|p| p.team_num != my_team && p.hero_id != 0)
        .collect();
    enemies_players.sort_by_key(|p| p.start_lane);
    let enemies: Vec<u32> = enemies_players.iter().map(|p| p.hero_id).collect();

    let lane_ally = players
        .values()
        .find(|p| p.team_num == my_team && p.account_id != my_account_id && p.start_lane == my_lane);
    let lane_ally_id = lane_ally.map(|p| p.hero_id);

    let lane_opponents: Vec<u32> = players
        .values()
        .filter(|p| p.team_num != my_team && p.start_lane == my_lane && p.hero_id != 0)
        .map(|p| p.hero_id)
        .collect();

    // ── 2. Read net worth at T=720s (12 min) for lane outcome ───────────────────
    let tick_at_720 = ((720.0 / tick_interval) as i32).min(playback_ticks.max(1) - 1);
    let mut my_lane_souls_at720: Option<u32> = None;
    let mut enemy_lane_souls_at720: Option<u32> = None;

    if tick_at_720 > tick_early {
        if let Ok(ctx_720) = parser.parse_to_tick(tick_at_720) {
            if let Some(ser_720) = ctx_720.serializers().get("CCitadelPlayerController") {
                let mut souls_map: HashMap<u32, u32> = HashMap::new();

                for (_, ent) in ctx_720.entities().iter() {
                    if ent.class_name.as_ref() != "CCitadelPlayerController" {
                        continue;
                    }
                    let steam_id = ent
                        .get_by_name("m_steamID", ser_720)
                        .map(extract_u64)
                        .unwrap_or(0);
                    let acc_id = if steam_id > STEAM_ID_BASE {
                        (steam_id - STEAM_ID_BASE) as u32
                    } else {
                        steam_id as u32
                    };
                    let nw = ent
                        .get_by_name("m_PlayerDataGlobal.m_iGoldNetWorth", ser_720)
                        .map(extract_u32)
                        .unwrap_or(0);

                    if acc_id != 0 && nw > 0 {
                        souls_map.insert(acc_id, nw);
                    }
                }

                let my_souls = souls_map.get(&my_account_id).copied().unwrap_or(0)
                    + lane_ally
                        .and_then(|a| souls_map.get(&a.account_id).copied())
                        .unwrap_or(0);

                let enemy_souls: u32 = players
                    .values()
                    .filter(|p| p.team_num != my_team && p.start_lane == my_lane)
                    .filter_map(|p| souls_map.get(&p.account_id).copied())
                    .sum();

                if my_souls > 0 || enemy_souls > 0 {
                    my_lane_souls_at720 = Some(my_souls);
                    enemy_lane_souls_at720 = Some(enemy_souls);
                }
            }
        }
    }

    // ── 3. Read winning team & guardian destruction times from events ─────────
    let expected_lane_mask = match my_lane {
        1 => Some(1),
        4 => Some(4),
        6 => Some(3),
        7 => Some(2),
        _ => None,
    };
    let enemy_team = if my_team == 2 { 3 } else if my_team == 3 { 2 } else { 0 };

    let mut winning_team = 0u32;
    let mut my_guardian_destroyed_at: Option<f32> = None;
    let mut enemy_guardian_destroyed_at: Option<f32> = None;

    if let Ok(events) = parser.events(None) {
        for ev in events {
            if ev.name == "k_EUserMsg_GameOver" && winning_team == 0 {
                if let Some(decoded) = boon::decode_event_payload(ev.msg_type, &ev.payload) {
                    if let Some(w) = extract_field_u32(&decoded, "winning_team:") {
                        winning_team = w;
                    }
                }
            } else if ev.name == "k_EUserMsg_BossKilled" {
                if let Some(decoded) = boon::decode_event_payload(ev.msg_type, &ev.payload) {
                    // entity_killed_class == 5 is Tier 1 Guardian
                    let class = extract_field_u32(&decoded, "entity_killed_class:");
                    let mask = extract_field_u32(&decoded, "objective_mask_change:");
                    let team = extract_field_u32(&decoded, "objective_team:");
                    let gametime = extract_field_f32(&decoded, "gametime:");

                    if class == Some(5) && mask.is_some() && mask == expected_lane_mask {
                        if team == Some(my_team) && my_guardian_destroyed_at.is_none() {
                            my_guardian_destroyed_at = gametime;
                        } else if team == Some(enemy_team) && enemy_guardian_destroyed_at.is_none() {
                            enemy_guardian_destroyed_at = gametime;
                        }
                    }
                }
            }
        }
    }

    let player_count = players.len() as u32;
    let lane_opt = if my_lane > 0 { Some(my_lane) } else { None };

    Ok(DemParseResult {
        match_id,
        duration_seconds,
        date_iso,
        my_hero_id: me.hero_id,
        my_team,
        allies,
        enemies,
        winning_team,
        lane: lane_opt,
        lane_ally_id,
        lane_opponents,
        player_slot: me.player_slot,
        my_lane_souls_at720,
        enemy_lane_souls_at720,
        my_guardian_destroyed_at,
        enemy_guardian_destroyed_at,
        player_count,
    })
}

fn extract_u32(val: &boon::FieldValue) -> u32 {
    match val {
        boon::FieldValue::U32(v) => *v,
        boon::FieldValue::I32(v) => *v as u32,
        boon::FieldValue::U64(v) => *v as u32,
        boon::FieldValue::I64(v) => *v as u32,
        boon::FieldValue::Bool(b) => *b as u32,
        _ => 0,
    }
}

fn extract_u64(val: &boon::FieldValue) -> u64 {
    match val {
        boon::FieldValue::U64(v) => *v,
        boon::FieldValue::I64(v) => *v as u64,
        boon::FieldValue::U32(v) => *v as u64,
        boon::FieldValue::I32(v) => *v as u64,
        _ => 0,
    }
}

fn extract_field_u32(s: &str, field: &str) -> Option<u32> {
    let pos = s.find(field)?;
    let slice = s[pos + field.len()..].trim_start();
    if slice.starts_with("None") {
        return None;
    }
    if let Some(inner) = slice.strip_prefix("Some(") {
        let content = inner.split(')').next()?;
        let num_str: String = content.chars().filter(|c| c.is_ascii_digit()).collect();
        return num_str.parse::<u32>().ok();
    }
    None
}

fn extract_field_f32(s: &str, field: &str) -> Option<f32> {
    let pos = s.find(field)?;
    let slice = s[pos + field.len()..].trim_start();
    if slice.starts_with("None") {
        return None;
    }
    if let Some(inner) = slice.strip_prefix("Some(") {
        let content = inner.split(')').next()?;
        let num_str: String = content.chars().filter(|c| c.is_ascii_digit() || *c == '.').collect();
        return num_str.parse::<f32>().ok();
    }
    None
}

fn chrono_approx_iso(secs: i64) -> Option<String> {
    // Quick UTC breakdown without external chrono dependency
    let days = secs / 86400;
    let rem_secs = secs % 86400;
    let hours = rem_secs / 3600;
    let mins = (rem_secs % 3600) / 60;
    let s = rem_secs % 60;

    // Convert days since Jan 1 1970 to YYYY-MM-DD
    let mut year = 1970;
    let mut d = days;
    loop {
        let leap = if (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0) { 1 } else { 0 };
        let days_in_year = 365 + leap;
        if d < days_in_year {
            let mut days_in_months = [31, 28 + leap, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            let mut month = 1;
            for dim in &mut days_in_months {
                if d < *dim {
                    let day = d + 1;
                    return Some(format!(
                        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
                        year, month, day, hours, mins, s
                    ));
                }
                d -= *dim;
                month += 1;
            }
            break;
        }
        d -= days_in_year;
        year += 1;
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_dem_file_with_guardians() {
        let test_path = r"K:\SteamLibrary\steamapps\common\Deadlock\game\citadel\replays\106010381.dem";
        if !Path::new(test_path).exists() {
            return;
        }

        // Account ID for the player (Remynder0) in match 106010381
        let result = parse_dem_file(test_path, 187934889, 106010381).expect("Failed to parse dem");
        println!("Parse result: my_team={}, winning_team={}, lane={:?}, my_g={:?}, enemy_g={:?}",
            result.my_team, result.winning_team, result.lane, result.my_guardian_destroyed_at, result.enemy_guardian_destroyed_at);
        assert_eq!(result.winning_team, 2);
        assert_eq!(result.my_team, 3);
        assert_eq!(result.lane, Some(4));
        assert!(result.my_guardian_destroyed_at.is_some());
        assert!(result.enemy_guardian_destroyed_at.is_some());
        let ally_g = result.my_guardian_destroyed_at.unwrap();
        let enemy_g = result.enemy_guardian_destroyed_at.unwrap();
        println!("Guardian times: Ally={ally_g}, Enemy={enemy_g}");
        assert!(enemy_g < ally_g, "Enemy guardian should have died before ally guardian");
        println!("Player slot in result: {:?}", result.player_slot);
    }
}
