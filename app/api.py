from fastapi import FastAPI, BackgroundTasks, HTTPException
import logging
from .selenium_workflow import run

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()


@app.post("/run")
async def trigger_run(lat: float, lon: float, background_tasks: BackgroundTasks):
    """Trigger the Selenium workflow in background."""
    logger.info("API call received lat=%s lon=%s", lat, lon)
    try:
        background_tasks.add_task(run, lat, lon)
    except Exception as exc:  # pragma: no cover - best effort logging
        logger.exception("Error scheduling workflow")
        raise HTTPException(status_code=500, detail=str(exc))
    return {"status": "started"}
