from django.db import migrations, models
from django.db.models import F


def publish_existing(apps, schema_editor):
    Review = apps.get_model("reviews", "Review")
    Review.objects.all().update(
        publication_status="published",
        published_at=F("created_at"),
        trust_multiplier=1.0,
    )


class Migration(migrations.Migration):

    dependencies = [
        ("reviews", "0001_initial"),
        ("jobs", "0004_job_completed_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="review",
            name="client_ip",
            field=models.GenericIPAddressField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="review",
            name="publication_status",
            field=models.CharField(
                choices=[("pending_mate", "Ожидает пары"), ("published", "Опубликован")],
                default="pending_mate",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="review",
            name="published_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="review",
            name="trust_multiplier",
            field=models.FloatField(
                default=1.0,
                help_text="Множитель доверия (0–1): сеть/IP, паттерны, обмен отзывами.",
            ),
        ),
        migrations.RunPython(publish_existing, migrations.RunPython.noop),
    ]
