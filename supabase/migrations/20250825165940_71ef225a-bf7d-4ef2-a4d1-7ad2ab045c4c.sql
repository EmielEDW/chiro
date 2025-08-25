-- Create storage buckets for images
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('product-images', 'product-images', true),
  ('profile-avatars', 'profile-avatars', true);

-- Add purchase price to items table
ALTER TABLE public.items 
ADD COLUMN purchase_price_cents integer DEFAULT 0;

-- Storage policies for product images
CREATE POLICY "Anyone can view product images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'product-images');

CREATE POLICY "Admins can upload product images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'product-images' AND 
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('admin', 'treasurer')
  )
);

CREATE POLICY "Admins can update product images" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'product-images' AND 
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('admin', 'treasurer')
  )
);

CREATE POLICY "Admins can delete product images" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'product-images' AND 
  auth.uid() IN (
    SELECT id FROM profiles WHERE role IN ('admin', 'treasurer')
  )
);

-- Storage policies for profile avatars
CREATE POLICY "Anyone can view profile avatars" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'profile-avatars');

CREATE POLICY "Users can upload their own avatar" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'profile-avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatar" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'profile-avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatar" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'profile-avatars' AND 
  auth.uid()::text = (storage.foldername(name))[1]
);