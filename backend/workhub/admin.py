from django.contrib import admin

from .models import FeaturedSlot, JobReminder, JobTemplate, PushDevice, SavedSearch, UserJobFavorite


@admin.register(FeaturedSlot)
class FeaturedSlotAdmin(admin.ModelAdmin):
    list_display = ("slot_index", "worker", "paid_until")
    list_filter = ("paid_until",)


admin.site.register(SavedSearch)
admin.site.register(PushDevice)
admin.site.register(UserJobFavorite)
admin.site.register(JobTemplate)
admin.site.register(JobReminder)
