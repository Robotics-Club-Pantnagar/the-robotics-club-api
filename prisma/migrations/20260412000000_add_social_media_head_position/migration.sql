-- Add social media head role after logistics head in Position enum ordering.
ALTER TYPE "Position" ADD VALUE 'SOCIAL_MEDIA_HEAD' AFTER 'LOGISTICS_HEAD';
