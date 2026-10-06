from fastapi import FastAPI

app = FastAPI(
    title="Research PMS ML Service",
    description="Machine Learning service for the Intelligent Project Management System",
    version="1.0.0"
)


@app.get("/")
def root():
    return {
        "message": "Research PMS ML Service is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }