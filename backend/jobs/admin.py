from django.contrib import admin

from .models import Job, JobApplication, WorkSubmission, JobStatusUpdate


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("title", "employer", "status", "assigned_to", "created_at")
    search_fields = ("title", "description")
    list_filter = ("status", "category")


admin.site.register(JobApplication)
admin.site.register(WorkSubmission)
admin.site.register(JobStatusUpdate)

