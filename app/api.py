from fastapi import FastAPI, BackgroundTasks, HTTPException
import logging
from .selenium_workflow import run as selenium_run

logger = logging.getLogger(__name__)
app = FastAPI()


@app.post("/run")
async def run_endpoint(lat: float, lon: float, background_tasks: BackgroundTasks):
    """Trigger Selenium workflow as a background task."""
    try:
        background_tasks.add_task(selenium_run, lat, lon)
    except Exception as exc:  # pragma: no cover - runtime errors
        logger.exception("Failed to schedule Selenium workflow: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to schedule workflow")
    return {"status": "scheduled"}
