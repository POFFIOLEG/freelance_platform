from django.db import migrations, models





class Migration(migrations.Migration):



    dependencies = [

        ("accounts", "0005_portfolio_gallery_extended"),

    ]



    operations = [

        migrations.AddField(

            model_name="profile",

            name="card_cover",

            field=models.ImageField(

                blank=True,

                help_text="Баннер над текстом карточки в блоке на главной странице.",

                null=True,

                upload_to="card_covers/",

                verbose_name="Изображение карточки на главной",

            ),

        ),

    ]

