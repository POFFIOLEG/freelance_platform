from django.db import migrations


def seed_slots(apps, schema_editor):
    FeaturedSlot = apps.get_model("workhub", "FeaturedSlot")
    for i in range(30):
        FeaturedSlot.objects.get_or_create(slot_index=i)


class Migration(migrations.Migration):
    dependencies = [
        ("workhub", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_slots, migrations.RunPython.noop),
    ]
