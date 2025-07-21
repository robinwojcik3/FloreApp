from fastapi import BackgroundTasks, FastAPI, HTTPException

from .selenium_workflow import run

app = FastAPI(title="Selenium API")


@app.post("/run")
async def run_endpoint(lat: float, lon: float, background_tasks: BackgroundTasks):
    """Trigger the Selenium workflow in the background."""
    try:
        background_tasks.add_task(run, lat, lon)
    except Exception as exc:  # pylint: disable=broad-except
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"status": "processing"}
