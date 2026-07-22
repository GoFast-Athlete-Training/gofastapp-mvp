-- Focal point for public run image (CSS object-position percentages).
ALTER TABLE "gofast_with_me"
ADD COLUMN "gofastWithMePhotoFocusX" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN "gofastWithMePhotoFocusY" INTEGER NOT NULL DEFAULT 50;
