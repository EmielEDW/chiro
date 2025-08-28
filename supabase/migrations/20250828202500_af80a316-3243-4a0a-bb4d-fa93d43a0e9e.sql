-- Add username column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN username text UNIQUE;

-- Create index for faster lookups
CREATE INDEX idx_profiles_username ON public.profiles(username);

-- Update existing profiles to have a default username based on their name
UPDATE public.profiles 
SET username = LOWER(REPLACE(name, ' ', '_')) || '_' || SUBSTRING(id::text, 1, 8)
WHERE username IS NULL;