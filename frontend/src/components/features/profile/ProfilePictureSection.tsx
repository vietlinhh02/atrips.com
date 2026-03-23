'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/src/components/ui/avatar';
import { Button } from '@/src/components/ui/button';
import { Trash, UploadSimple } from '@phosphor-icons/react';
import { useToast } from '@/src/components/ui/use-toast';
import { useState, useEffect, useRef } from 'react';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import uploadService from '@/src/services/uploadService';
import { getDefaultAvatarUrl } from '@/src/lib/avatar';

interface ProfilePictureSectionProps {
  avatarUrl?: string;
  name?: string;
  email?: string;
  bio?: string;
  onUpdate: (data: { avatarUrl?: string; name?: string; bio?: string }) => Promise<void>;
}

export function ProfilePictureSection({ avatarUrl, name, email, bio, onUpdate }: ProfilePictureSectionProps) {
  const { success, error } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Split name for inputs
  const nameParts = name ? name.split(/\s+/) : [];
  const [fName, setFName] = useState(nameParts[0] || '');
  const [lName, setLName] = useState(nameParts.slice(1).join(' ') || '');
  const [bioState, setBioState] = useState(bio || '');
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Track the last values we updated to, so we don't reset when props change
  const lastUpdatedName = useRef<string | null>(null);
  const lastUpdatedBio = useRef<string | null>(null);

  useEffect(() => {
    // Only sync from props if we didn't just update to this value
    const currentNameFromProps = name || '';
    if (lastUpdatedName.current === currentNameFromProps) {
      // Props have caught up with our update, clear the ref
      lastUpdatedName.current = null;
      return;
    }
    // Only sync if we're not waiting for our own update to come back
    if (lastUpdatedName.current === null) {
      const parts = name ? name.split(/\s+/) : [];
      setFName(parts[0] || '');
      setLName(parts.slice(1).join(' ') || '');
    }
  }, [name]);

  useEffect(() => {
    // Only sync from props if we didn't just update to this value
    const currentBioFromProps = bio || '';
    if (lastUpdatedBio.current === currentBioFromProps) {
      // Props have caught up with our update, clear the ref
      lastUpdatedBio.current = null;
      return;
    }
    // Only sync if we're not waiting for our own update to come back
    if (lastUpdatedBio.current === null) {
      setBioState(bio || '');
    }
  }, [bio]);

  // Clear previewUrl when avatarUrl prop updates (e.g., after successful upload)
  useEffect(() => {
    if (avatarUrl && previewUrl && avatarUrl === previewUrl) {
      setPreviewUrl(null);
    }
  }, [avatarUrl, previewUrl]);

  const handleNameBlur = async () => {
    const newName = `${fName} ${lName}`.trim();
    if (newName !== (name || '')) {
      try {
        // Track what we're updating to
        lastUpdatedName.current = newName;
        await onUpdate({ name: newName });
        success("Profile updated", "Your name has been updated successfully.");
      } catch {
        error("Update failed", "Failed to update name.");
        // Revert on error and clear the ref
        lastUpdatedName.current = null;
        const parts = name ? name.split(/\s+/) : [];
        setFName(parts[0] || '');
        setLName(parts.slice(1).join(' ') || '');
      }
    }
  };

  const handleBioBlur = async () => {
    if (bioState !== (bio || '')) {
      try {
        // Track what we're updating to
        lastUpdatedBio.current = bioState;
        await onUpdate({ bio: bioState });
        success("Profile updated", "Your bio has been updated successfully.");
      } catch {
        error("Update failed", "Failed to update bio.");
        // Revert on error and clear the ref
        lastUpdatedBio.current = null;
        setBioState(bio || '');
      }
    }
  };

  const initials = name
    ? name
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
    : 'U';

  const avatarSrc =
    previewUrl ||
    avatarUrl ||
    getDefaultAvatarUrl(email, name);

  const handleRemove = async () => {
    try {
      await onUpdate({ avatarUrl: '' });
      success("Avatar removed", "Your profile picture has been reset.");
    } catch {
      error("Update failed", "Failed to remove avatar.");
    }
  };

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);

      // Generate preview immediately for better UX
      const preview = await uploadService.getPreviewUrl(file);
      setPreviewUrl(preview);

      // Upload to Cloudinary
      const uploadedUrl = await uploadService.uploadAvatar(file);

      // Update profile in backend
      await onUpdate({ avatarUrl: uploadedUrl });

      success("Success", "Profile picture updated successfully");
      // Keep showing the uploaded URL until the prop updates
      setPreviewUrl(uploadedUrl);
    } catch (err) {
      console.error('Upload error:', err);
      error(
        "Upload failed",
        err instanceof Error ? err.message : "Failed to upload image"
      );
      setPreviewUrl(null); // Clear preview on error
    } finally {
      setUploading(false);
      // Reset input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Profile Picture Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 items-center">
        <div className="flex flex-col gap-1 text-center sm:text-left">
          <p className="text-[16px] font-bold text-[var(--neutral-100)]">
            Profile Picture
          </p>
          <p className="text-[13px] text-[var(--neutral-60)] leading-relaxed">
            We support PNG, JPG under 10mb.
          </p>
        </div>

        {/* Buttons - Desktop only */}
        <div className="hidden sm:flex items-center gap-3">
          <Button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            className="bg-[var(--primary-main)] text-white hover:bg-[var(--primary-hover)] rounded-[12px] h-10 px-5 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UploadSimple size={18} weight="bold" />
            {uploading ? 'Uploading...' : 'Upload Image'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleRemove}
            disabled={uploading}
            className="border-[var(--neutral-30)] text-[var(--neutral-100)] hover:bg-[var(--neutral-20)] rounded-[12px] h-10 px-5 font-medium transition-all bg-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash size={18} weight="bold" />
            Remove
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left: Avatar */}
        <div className="flex flex-col items-center gap-4 shrink-0 mx-auto lg:mx-0">
          <div className="relative">
            <Avatar className="h-52 w-52 border-4 border-white">
              <AvatarImage src={avatarSrc} alt="Profile" />
              <AvatarFallback className="text-5xl font-bold">{initials}</AvatarFallback>
            </Avatar>
            {uploading && (
              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent"></div>
              </div>
            )}
          </div>

          {/* Buttons - Mobile only */}
          <div className="flex sm:hidden items-center gap-3">
            <Button
              type="button"
              onClick={handleUpload}
              disabled={uploading}
              className="bg-[var(--primary-main)] text-white hover:bg-[var(--primary-hover)] rounded-[12px] h-10 px-5 font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UploadSimple size={18} weight="bold" />
              {uploading ? 'Uploading...' : 'Upload Image'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleRemove}
              disabled={uploading}
              className="border-[var(--neutral-30)] text-[var(--neutral-100)] hover:bg-[var(--neutral-20)] rounded-[12px] h-10 px-5 font-medium transition-all bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash size={18} weight="bold" />
              Remove
            </Button>
          </div>
        </div>

        {/* Right: Name Inputs */}
        <div className="flex-1 w-full flex flex-col gap-6 items-center justify-center">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-semibold text-[var(--neutral-100)] ml-1">
                First Name
              </label>
              <Input
                type="text"
                value={fName}
                onChange={(e) => setFName(e.target.value)}
                onBlur={handleNameBlur}
                placeholder="Nguyen"
                className="h-12 rounded-[12px] border-[var(--neutral-30)] bg-white text-[15px] text-[var(--neutral-100)] focus:border-[var(--primary-main)] focus:ring-1 focus:ring-[var(--primary-main)] transition-all px-4"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-semibold text-[var(--neutral-100)] ml-1">
                Last Name
              </label>
              <Input
                type="text"
                value={lName}
                onChange={(e) => setLName(e.target.value)}
                onBlur={handleNameBlur}
                placeholder="Nam"
                className="h-12 rounded-[12px] border-[var(--neutral-30)] bg-white text-[15px] text-[var(--neutral-100)] focus:border-[var(--primary-main)] focus:ring-1 focus:ring-[var(--primary-main)] transition-all px-4"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <label className="text-[14px] font-semibold text-[var(--neutral-100)] ml-1">
              Bio
            </label>
            <Textarea
              value={bioState}
              onChange={(e) => setBioState(e.target.value)}
              onBlur={handleBioBlur}
              placeholder="Tell us about yourself..."
              className="min-h-[100px] rounded-[12px] border-[var(--neutral-30)] bg-white text-[15px] text-[var(--neutral-100)] focus:border-[var(--primary-main)] focus:ring-1 focus:ring-[var(--primary-main)] transition-all px-4 py-3 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Upload profile picture"
      />
    </div>
  );
}
