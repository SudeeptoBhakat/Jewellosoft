# Generated migration for theme field update

from django.db import migrations, models


def migrate_legacy_themes(apps, schema_editor):
    """Convert old theme values to new key-based system."""
    Shop = apps.get_model('accounts', 'Shop')
    legacy_map = {
        'System Default': 'default',
        'Dark Mode': 'dark',
        'Light Mode': 'light',
        'halloween': 'default',
    }
    for shop in Shop.objects.all():
        if shop.theme in legacy_map:
            shop.theme = legacy_map[shop.theme]
            shop.save(update_fields=['theme'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_syncqueue_shop_supabase_email_shop_supabase_user_id'),
    ]

    operations = [
        # First run data migration on the old field
        migrations.RunPython(migrate_legacy_themes, migrations.RunPython.noop),
        # Then alter the field — no choices constraint, just a plain CharField
        migrations.AlterField(
            model_name='shop',
            name='theme',
            field=models.CharField(default='default', max_length=30),
        ),
    ]
