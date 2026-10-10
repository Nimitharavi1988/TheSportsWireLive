-- YouTube Shorts uploads are recorded in SocialPost like the other platforms.
ALTER TYPE "SocialPlatform" ADD VALUE IF NOT EXISTS 'youtube';
