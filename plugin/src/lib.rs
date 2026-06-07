use extism_pdk::{config, error, http, info, warn, HttpRequest};
use nd_pdk::scrobbler::{
    Error, IsAuthorizedRequest, NowPlayingRequest, ScrobbleRequest, Scrobbler,
};
use serde_json::json;

nd_pdk::register_scrobbler!(SpindleCollector);

#[derive(Default)]
struct SpindleCollector;

impl Scrobbler for SpindleCollector {
    fn is_authorized(&self, _req: IsAuthorizedRequest) -> Result<bool, Error> {
        Ok(true)
    }

    fn now_playing(&self, _req: NowPlayingRequest) -> Result<(), Error> {
        Ok(())
    }

    fn scrobble(&self, req: ScrobbleRequest) -> Result<(), Error> {
        let backend_url = match config::get("backend_url") {
            Ok(Some(u)) if !u.is_empty() => u,
            _ => {
                warn!("spindle: backend_url not configured; skipping");
                return Ok(());
            }
        };
        let secret = config::get("shared_secret").ok().flatten().unwrap_or_default();

        let body = json!({
            "played_at": req.timestamp,
            "user": req.username,
            "nd_track_id": req.track.id,
        })
        .to_string();

        let url = format!("{}/ingest", backend_url.trim_end_matches('/'));
        let http_req = HttpRequest::new(&url)
            .with_method("POST")
            .with_header("Content-Type", "application/json")
            .with_header("X-Spindle-Secret", &secret);

        match http::request::<String>(&http_req, Some(body)) {
            Ok(res) => {
                let status = res.status_code();
                if (200..300).contains(&status) {
                    info!("spindle: ingested track {} (status {})", req.track.id, status);
                } else {
                    warn!("spindle: backend returned status {}", status);
                }
            }
            Err(e) => error!("spindle: ingest POST failed: {:?}", e),
        }
        Ok(())
    }
}
