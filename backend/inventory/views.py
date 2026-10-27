import django_filters
from django.db.models import F, Sum
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import IsAdminRole

from .models import HospitalSupply


class HospitalSupplySerializer(serializers.ModelSerializer):
    is_low_stock = serializers.BooleanField(read_only=True)

    class Meta:
        model = HospitalSupply
        fields = ["id", "name", "sku", "category", "quantity", "unit", "minimum_stock_level",
                  "supplier", "notes", "is_low_stock", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_sku(self, value):
        value = value.strip().upper()
        qs = HospitalSupply.objects.filter(sku__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("An item with this SKU already exists.")
        return value


class SupplyFilter(django_filters.FilterSet):
    low_stock = django_filters.BooleanFilter(method="filter_low_stock")
    category = django_filters.CharFilter(field_name="category", lookup_expr="iexact")

    class Meta:
        model = HospitalSupply
        fields = ["low_stock", "category"]

    def filter_low_stock(self, queryset, name, value):
        low = queryset.filter(quantity__lte=F("minimum_stock_level"))
        return low if value else queryset.exclude(pk__in=low.values("pk"))


class HospitalSupplyViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    serializer_class = HospitalSupplySerializer
    queryset = HospitalSupply.objects.all()
    filterset_class = SupplyFilter
    search_fields = ["name", "sku", "supplier", "category"]
    ordering_fields = ["name", "quantity", "updated_at"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    @action(detail=False, methods=["get"])
    def stats(self, request):
        qs = HospitalSupply.objects.all()
        return Response({
            "total_items": qs.count(),
            "total_units": qs.aggregate(total=Sum("quantity"))["total"] or 0,
            "low_stock_items": qs.filter(quantity__lte=F("minimum_stock_level")).count(),
            "out_of_stock_items": qs.filter(quantity=0).count(),
            "categories": sorted(c for c in qs.values_list("category", flat=True).distinct() if c),
        })
