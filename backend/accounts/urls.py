from django.urls import path

from . import views

urlpatterns = [
    path("register/", views.PatientRegisterView.as_view(), name="register"),
    path("register/doctor/", views.DoctorApplicationView.as_view(), name="register-doctor"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("refresh/", views.RefreshView.as_view(), name="token-refresh"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("me/", views.MeView.as_view(), name="me"),
    path("change-password/", views.ChangePasswordView.as_view(), name="change-password"),
]
