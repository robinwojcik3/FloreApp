from fastapi import BackgroundTasks, FastAPI, Query
import logging

from .selenium_workflow import run

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Selenium API")


@app.post("/run")
async def run_workflow(
    background_tasks: BackgroundTasks,
    lat: float = Query(...),
    lon: float = Query(...),
) -> dict[str, str]:
    """Launch the Selenium workflow in the background."""
    logger.info("Received run request: lat=%s lon=%s", lat, lon)
    background_tasks.add_task(run, lat, lon)
    return {"status": "started"}
