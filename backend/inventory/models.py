from django.db import models


class HospitalSupply(models.Model):
    name = models.CharField(max_length=150)
    sku = models.CharField("SKU", max_length=50, unique=True)
    category = models.CharField(max_length=80, blank=True, db_index=True)
    quantity = models.PositiveIntegerField(default=0)
    unit = models.CharField(max_length=30, default="units")
    minimum_stock_level = models.PositiveIntegerField(default=0)
    supplier = models.CharField(max_length=150, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "hospital supplies"

    def __str__(self):
        return f"{self.name} ({self.sku})"

    @property
    def is_low_stock(self):
        return self.quantity <= self.minimum_stock_level
