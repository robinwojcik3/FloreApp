from fastapi import BackgroundTasks, FastAPI, Query
import logging

from .selenium_workflow import run

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()


def _run_task(lat: float, lon: float) -> None:
    result = run(lat, lon)
    logger.info("Workflow finished with result: %s", result)


@app.post("/run")
async def trigger_run(
    background_tasks: BackgroundTasks,
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
) -> dict[str, str]:
    """Schedule the Selenium workflow in the background."""
    background_tasks.add_task(_run_task, lat, lon)
    return {"status": "scheduled"}
