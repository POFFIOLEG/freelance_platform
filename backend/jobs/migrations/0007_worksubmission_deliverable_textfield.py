from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("jobs", "0006_moderator_kyc_push_disputes"),
    ]

    operations = [
        migrations.AlterField(
            model_name="worksubmission",
            name="deliverable_url",
            field=models.TextField(blank=True),
        ),
    ]
