use std::time::{Duration, Instant};

const MAX_FAILED_ATTEMPTS: u32 = 10;
const BASE_LOCKOUT_DURATION: Duration = Duration::from_secs(5);
const MAX_LOCKOUT_DURATION: Duration = Duration::from_secs(300);

pub struct AuthAttemptState {
    failed_attempts: u32,
    last_failed_time: Option<Instant>,
    lockout_until: Option<Instant>,
}

impl AuthAttemptState {
    pub fn new() -> Self {
        Self {
            failed_attempts: 0,
            last_failed_time: None,
            lockout_until: None,
        }
    }

    pub fn is_locked_out(&self) -> bool {
        if let Some(lockout) = self.lockout_until {
            Instant::now() < lockout
        } else {
            false
        }
    }

    pub fn record_failure(&mut self) -> Result<(), String> {
        self.failed_attempts += 1;
        self.last_failed_time = Some(Instant::now());

        if self.failed_attempts >= MAX_FAILED_ATTEMPTS {
            self.lockout_until = Some(Instant::now() + MAX_LOCKOUT_DURATION);
            return Err(format!(
                "Too many failed attempts. Account locked for {} minutes.",
                MAX_LOCKOUT_DURATION.as_secs() / 60
            ));
        }

        let lockout_duration = BASE_LOCKOUT_DURATION
            .saturating_mul(2_u32.pow(self.failed_attempts.saturating_sub(1)));
        let lockout_duration = std::cmp::min(lockout_duration, MAX_LOCKOUT_DURATION);
        self.lockout_until = Some(Instant::now() + lockout_duration);

        Err(format!(
            "Too many failed attempts. Please try again in {} seconds.",
            lockout_duration.as_secs()
        ))
    }

    pub fn reset(&mut self) {
        self.failed_attempts = 0;
        self.last_failed_time = None;
        self.lockout_until = None;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_is_not_locked_out() {
        let state = AuthAttemptState::new();
        assert!(!state.is_locked_out());
    }

    #[test]
    fn test_first_failure_returns_error_with_wait() {
        let mut state = AuthAttemptState::new();
        let result = state.record_failure();
        assert!(result.is_err());
        assert!(state.is_locked_out());
    }

    #[test]
    fn test_reset_clears_lockout() {
        let mut state = AuthAttemptState::new();
        state.record_failure().ok();
        state.reset();
        assert!(!state.is_locked_out());
        assert_eq!(state.failed_attempts, 0);
    }
}
