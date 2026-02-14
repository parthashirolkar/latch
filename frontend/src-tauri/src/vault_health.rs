use crate::vault::Entry;
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WeakPassword {
    pub entry_id: String,
    pub title: String,
    pub username: String,
    pub score: u8,
    pub entropy: f64,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReusedPassword {
    pub password: String,
    pub entries: Vec<ReusedEntry>,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReusedEntry {
    pub entry_id: String,
    pub title: String,
    pub username: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreachedCredential {
    pub entry_id: String,
    pub title: String,
    pub username: String,
    pub breach_count: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VaultHealthReport {
    pub overall_score: u8,
    pub weak_passwords: Vec<WeakPassword>,
    pub reused_passwords: Vec<ReusedPassword>,
    pub breached_credentials: Vec<BreachedCredential>,
    pub total_entries: usize,
    pub strong_passwords: usize,
    pub average_entropy: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BreachResult {
    pub hash_suffix: String,
    pub count: u32,
}

pub fn check_weak_passwords(entries: &[Entry]) -> Vec<WeakPassword> {
    let mut weak_passwords = Vec::new();

    for entry in entries {
        let report = crate::password_generator::analyze_password_strength(&entry.password);

        if report.score < 3 {
            weak_passwords.push(WeakPassword {
                entry_id: entry.id.clone(),
                title: entry.title.clone(),
                username: entry.username.clone(),
                score: report.score,
                entropy: report.entropy,
                label: report.label,
            });
        }
    }

    weak_passwords.sort_by(|a, b| a.entropy.partial_cmp(&b.entropy).unwrap());
    weak_passwords
}

pub fn check_reused_passwords(entries: &[Entry]) -> Vec<ReusedPassword> {
    let mut password_map: HashMap<String, Vec<ReusedEntry>> = HashMap::new();

    for entry in entries {
        password_map
            .entry(entry.password.clone())
            .or_default()
            .push(ReusedEntry {
                entry_id: entry.id.clone(),
                title: entry.title.clone(),
                username: entry.username.clone(),
            });
    }

    let mut reused_passwords = Vec::new();

    for (password, entries_list) in password_map {
        let count = entries_list.len();
        if count > 1 {
            reused_passwords.push(ReusedPassword {
                password: password.clone(),
                entries: entries_list,
                count,
            });
        }
    }

    reused_passwords.sort_by(|a, b| b.count.cmp(&a.count));
    reused_passwords
}

pub fn check_breach_status(entries: &[Entry]) -> Vec<BreachedCredential> {
    let mut breached_credentials = Vec::new();

    for entry in entries {
        let _hash_prefix = get_breach_hash_prefix(&entry.password);

        if let Some(breach_data) = check_single_breach(&entry.password) {
            if breach_data.count > 0 {
                breached_credentials.push(BreachedCredential {
                    entry_id: entry.id.clone(),
                    title: entry.title.clone(),
                    username: entry.username.clone(),
                    breach_count: breach_data.count,
                });
            }
        }
    }

    breached_credentials.sort_by(|a, b| b.breach_count.cmp(&a.breach_count));
    breached_credentials
}

fn get_breach_hash_prefix(password: &str) -> String {
    let hash = Sha1::digest(password.as_bytes());
    let hash_hex = format!("{:x}", hash);
    hash_prefix_to_anonymous(&hash_hex)
}

fn hash_prefix_to_anonymous(hash: &str) -> String {
    hash[..5].to_uppercase()
}

fn check_single_breach(password: &str) -> Option<BreachResult> {
    let hash = Sha1::digest(password.as_bytes());
    let hash_hex = format!("{:x}", hash);
    let hash_upper = hash_hex.to_uppercase();

    Some(BreachResult {
        hash_suffix: hash_upper[5..].to_string(),
        count: 0,
    })
}

pub fn calculate_vault_health_score(
    weak_count: usize,
    reused_count: usize,
    breached_count: usize,
    total_entries: usize,
) -> u8 {
    if total_entries == 0 {
        return 100;
    }

    let weak_ratio = weak_count as f64 / total_entries as f64;
    let reused_ratio = reused_count as f64 / total_entries as f64;
    let breached_ratio = breached_count as f64 / total_entries as f64;

    let mut score = 100.0;

    score -= weak_ratio * 40.0;
    score -= reused_ratio * 30.0;
    score -= breached_ratio * 50.0;

    score.clamp(0.0, 100.0) as u8
}

pub fn check_vault_health(entries: &[Entry]) -> VaultHealthReport {
    let weak_passwords = check_weak_passwords(entries);
    let reused_passwords = check_reused_passwords(entries);
    let breached_credentials = check_breach_status(entries);

    let reused_entries_count: usize = reused_passwords.iter().map(|rp| rp.entries.len() - 1).sum();

    let overall_score = calculate_vault_health_score(
        weak_passwords.len(),
        reused_entries_count,
        breached_credentials.len(),
        entries.len(),
    );

    let strong_passwords = entries.len() - weak_passwords.len();

    let total_entropy: f64 = entries
        .iter()
        .map(|e| crate::password_generator::analyze_password_strength(&e.password).entropy)
        .sum();

    let average_entropy = if entries.is_empty() {
        0.0
    } else {
        total_entropy / entries.len() as f64
    };

    VaultHealthReport {
        overall_score,
        weak_passwords,
        reused_passwords,
        breached_credentials,
        total_entries: entries.len(),
        strong_passwords,
        average_entropy,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_entry(id: &str, title: &str, username: &str, password: &str) -> Entry {
        Entry {
            id: id.to_string(),
            title: title.to_string(),
            username: username.to_string(),
            password: password.to_string(),
            url: None,
            icon_url: None,
        }
    }

    #[test]
    fn test_check_weak_passwords() {
        let entries = vec![
            create_test_entry("1", "Test1", "user1", "password123"),
            create_test_entry("2", "Test2", "user2", "qwerty123"),
            create_test_entry("3", "Test3", "user3", "Tr0ub4dor&3!p@ss"),
        ];

        let weak_passwords = check_weak_passwords(&entries);

        assert_eq!(weak_passwords.len(), 2);
        assert!(weak_passwords.iter().all(|wp| wp.score < 3));
    }

    #[test]
    fn test_check_reused_passwords() {
        let entries = vec![
            create_test_entry("1", "Test1", "user1", "samepass"),
            create_test_entry("2", "Test2", "user2", "samepass"),
            create_test_entry("3", "Test3", "user3", "different"),
        ];

        let reused_passwords = check_reused_passwords(&entries);

        assert_eq!(reused_passwords.len(), 1);
        assert_eq!(reused_passwords[0].count, 2);
        assert_eq!(reused_passwords[0].entries.len(), 2);
    }

    #[test]
    fn test_calculate_vault_health_score_perfect() {
        let score = calculate_vault_health_score(0, 0, 0, 10);
        assert_eq!(score, 100);
    }

    #[test]
    fn test_calculate_vault_health_score_weak() {
        let score = calculate_vault_health_score(5, 0, 0, 10);
        assert!(score < 100);
        assert!(score > 0);
    }

    #[test]
    fn test_check_vault_health() {
        let entries = vec![
            create_test_entry("1", "Test1", "user1", "password123"),
            create_test_entry("2", "Test2", "user2", "password123"),
            create_test_entry("3", "Test3", "user3", "Tr0ub4dor&3!p@ss"),
        ];

        let report = check_vault_health(&entries);

        assert_eq!(report.total_entries, 3);
        assert!(!report.weak_passwords.is_empty());
        assert!(!report.reused_passwords.is_empty());
        assert!(report.overall_score < 100);
    }

    #[test]
    fn test_get_breach_hash_prefix() {
        let prefix = get_breach_hash_prefix("password");
        assert_eq!(prefix.len(), 5);
        assert!(prefix.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_hash_prefix_to_anonymous() {
        let hash = "5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8";
        let prefix = hash_prefix_to_anonymous(hash);
        assert_eq!(prefix, "5BAA6");
    }
}
