"""Consistent, safe API error responses."""
import logging

from django.core.exceptions import PermissionDenied, ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger("healthcare")


class Conflict(exceptions.APIException):
    """Raised when a request conflicts with current state (e.g. slot already booked)."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "The request conflicts with the current state of the resource."
    default_code = "conflict"


def api_exception_handler(exc, context):
    # Translate Django model validation errors into DRF 400 responses.
    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, "message_dict"):
            exc = exceptions.ValidationError(exc.message_dict)
        else:
            exc = exceptions.ValidationError({"detail": exc.messages})
    elif isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, PermissionDenied):
        exc = exceptions.PermissionDenied()

    response = exception_handler(exc, context)
    if response is None:
        # Unexpected error: log full details server-side, return a generic message.
        logger.exception("Unhandled API error", exc_info=exc)
        return Response(
            {"detail": "An unexpected server error occurred. Please try again later."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    # Lists of non-field errors are flattened into a single readable "detail".
    data = response.data
    if isinstance(data, dict) and "non_field_errors" in data and "detail" not in data:
        errors = data.get("non_field_errors")
        if isinstance(errors, list) and errors:
            data["detail"] = " ".join(str(e) for e in errors)
    elif isinstance(data, list):
        response.data = {"detail": " ".join(str(e) for e in data)}
    return response
