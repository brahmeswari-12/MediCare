from django.urls import path

from .views import PatientProfileView, PatientViewSet

patient_list = PatientViewSet.as_view({"get": "list"})
patient_detail = PatientViewSet.as_view({"get": "retrieve"})

urlpatterns = [
    path("", patient_list, name="patient-list"),
    path("profile/", PatientProfileView.as_view(), name="patient-profile"),
    path("<int:pk>/", patient_detail, name="patient-detail"),
]
