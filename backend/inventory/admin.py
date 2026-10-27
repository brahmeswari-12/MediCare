from django.contrib import admin

from .models import HospitalSupply


@admin.register(HospitalSupply)
class HospitalSupplyAdmin(admin.ModelAdmin):
    list_display = ["name", "sku", "category", "quantity", "minimum_stock_level", "updated_at"]
    search_fields = ["name", "sku"]
