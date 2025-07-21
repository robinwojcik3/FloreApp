import logging
from fastapi import BackgroundTasks, FastAPI, HTTPException

from .selenium_workflow import run

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Selenium API")


@app.post("/run")
async def trigger_run(lat: float, lon: float, background_tasks: BackgroundTasks):
    """Launch the Selenium workflow asynchronously."""
    if lat is None or lon is None:
        raise HTTPException(status_code=400, detail="lat and lon are required")

    background_tasks.add_task(run, lat, lon)
    logger.info("Workflow triggered for lat=%s lon=%s", lat, lon)
    return {"status": "started"}

