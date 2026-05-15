use std::future::Future;
use std::pin::Pin;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BreachResult {
    pub hash_suffix: String,
    pub count: u32,
}

pub trait BreachChecker: Send + Sync {
    fn check(
        &self,
        password: &str,
    ) -> Pin<Box<dyn Future<Output = Option<BreachResult>> + Send + '_>>;
}

pub struct PwnedPasswordsApi;

impl BreachChecker for PwnedPasswordsApi {
    fn check(
        &self,
        password: &str,
    ) -> Pin<Box<dyn Future<Output = Option<BreachResult>> + Send + '_>> {
        let password = password.to_string();
        Box::pin(async move {
            use sha1::{Digest, Sha1};
            let hash = Sha1::digest(password.as_bytes());
            let hash_hex = format!("{:x}", hash);
            let hash_upper = hash_hex.to_uppercase();
            let prefix = &hash_upper[..5];
            let suffix = &hash_upper[5..];

            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .ok()?;

            let response = client
                .get(format!("https://api.pwnedpasswords.com/range/{}", prefix))
                .header("User-Agent", "Latch-Password-Manager")
                .send()
                .await
                .ok()?;

            let body = response.text().await.ok()?;

            for line in body.lines() {
                let parts: Vec<&str> = line.split(':').collect();
                if parts.len() == 2 && parts[0].eq_ignore_ascii_case(suffix) {
                    let count: u32 = parts[1].trim().parse().unwrap_or(0);
                    return Some(BreachResult {
                        hash_suffix: suffix.to_string(),
                        count,
                    });
                }
            }

            None
        })
    }
}

#[allow(dead_code)]
pub struct StubBreachChecker {
    pub results: Vec<(String, u32)>,
}

impl BreachChecker for StubBreachChecker {
    fn check(
        &self,
        password: &str,
    ) -> Pin<Box<dyn Future<Output = Option<BreachResult>> + Send + '_>> {
        let password = password.to_string();
        let results = self.results.clone();
        Box::pin(async move {
            for (pwd, count) in &results {
                if pwd == &password {
                    return Some(BreachResult {
                        hash_suffix: String::new(),
                        count: *count,
                    });
                }
            }
            None
        })
    }
}
