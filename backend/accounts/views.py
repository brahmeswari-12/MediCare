from django.db import transaction
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .serializers import (
    ChangePasswordSerializer,
    DoctorApplicationSerializer,
    LoginSerializer,
    LogoutSerializer,
    PatientRegistrationSerializer,
    profile_summary,
)


class AuthThrottleMixin:
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class PatientRegisterView(AuthThrottleMixin, generics.CreateAPIView):
    """Public patient self-registration. Only creates PATIENT accounts."""

    permission_classes = [AllowAny]
    serializer_class = PatientRegistrationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["name"] = user.full_name
        return Response(
            {"user": profile_summary(user), "access": str(refresh.access_token), "refresh": str(refresh)},
            status=status.HTTP_201_CREATED,
        )


class DoctorApplicationView(AuthThrottleMixin, generics.CreateAPIView):
    """Public doctor application. Creates a PENDING doctor awaiting admin approval."""

    permission_classes = [AllowAny]
    serializer_class = DoctorApplicationSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                "user": profile_summary(user),
                "detail": "Application received. You can sign in now; patients will be able to "
                          "book you once an administrator approves your profile.",
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(AuthThrottleMixin, TokenObtainPairView):
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer


class RefreshView(TokenRefreshView):
    permission_classes = [AllowAny]


class LogoutView(APIView):
    """Blacklists the given refresh token so it can no longer be used."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            token = RefreshToken(serializer.validated_data["refresh"])
            if str(token.get("user_id")) != str(request.user.id):
                return Response({"detail": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)
            token.blacklist()
        except TokenError:
            # Already expired or blacklisted: the session is over either way.
            pass
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(profile_summary(request.user))


class ChangePasswordView(APIView):
    """Changes the password, revokes every existing refresh token for the user
    (signing out other devices) and returns a fresh token pair."""

    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.save(update_fields=["password"])

        for outstanding in OutstandingToken.objects.filter(user=user):
            BlacklistedToken.objects.get_or_create(token=outstanding)

        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        refresh["name"] = user.full_name
        return Response(
            {"detail": "Password updated.", "access": str(refresh.access_token), "refresh": str(refresh)}
        )
