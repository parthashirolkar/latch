pub mod credential;
pub mod generator;
pub mod health;
pub mod session;
pub mod vault;

use crate::vault::{storage::VaultStorage, workspace::Workspace};
use std::sync::{Arc, Mutex};

pub struct VaultState(pub Arc<Mutex<(VaultStorage, Workspace)>>);

impl VaultState {
    pub fn new(storage: VaultStorage, workspace: Workspace) -> Self {
        Self(Arc::new(Mutex::new((storage, workspace))))
    }

    pub fn lock<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&VaultStorage, &mut Workspace) -> Result<T, String>,
    {
        let mut guard = self
            .0
            .lock()
            .map_err(|_| "Vault is temporarily unavailable")?;
        let (ref storage, ref mut workspace) = *guard;
        f(storage, workspace)
    }
}
