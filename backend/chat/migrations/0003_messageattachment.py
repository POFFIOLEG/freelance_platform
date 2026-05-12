import django.db.models.deletion

from django.db import migrations, models





class Migration(migrations.Migration):



    dependencies = [

        ("chat", "0002_message_attachment_alter_message_text"),

    ]



    operations = [

        migrations.CreateModel(

            name="MessageAttachment",

            fields=[

                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),

                ("file", models.FileField(upload_to="chat_attachments/")),

                ("sort_order", models.PositiveSmallIntegerField(default=0)),

                (

                    "message",

                    models.ForeignKey(

                        on_delete=django.db.models.deletion.CASCADE,

                        related_name="attachment_files",

                        to="chat.message",

                    ),

                ),

            ],

            options={

                "ordering": ["sort_order", "id"],

            },

        ),

    ]

