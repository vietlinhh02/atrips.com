"""Request/response models for the worker API."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class TaskType(str, Enum):
    HOTELS = "hotels"
    RESTAURANTS = "restaurants"
    ATTRACTIONS = "attractions"
    TRANSPORT = "transport"
    ACTIVITIES = "activities"
    NIGHTLIFE = "nightlife"
    CUSTOM = "custom"


class TaskRequest(BaseModel):
    task_id: str = Field(..., alias="taskId")
    task_type: TaskType = Field(..., alias="taskType")
    query: str
    context: dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class TaskResult(BaseModel):
    task_id: str = Field(..., alias="taskId")
    status: str  # "success" | "error" | "timeout"
    data: Any = None
    error: str | None = None

    model_config = {"populate_by_name": True}


class HealthResponse(BaseModel):
    status: str
    active_tasks: int
    max_concurrent: int
