-- Clear the incorrect logo_url that contains the admin's personal avatar
-- The barbershop logo should be uploaded independently via the barber app
UPDATE public.tenants
SET logo_url = NULL,
    updated_at = now()
WHERE id = '73d61f2f-b369-41f3-8915-8e6de52d6378'
  AND logo_url LIKE '%avatars/admins%';