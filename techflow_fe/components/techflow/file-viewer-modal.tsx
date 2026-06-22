"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileQuestion, Download } from "lucide-react";
import { API_BASE } from "@/lib/api";

interface FileViewerModalProps {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
  // Production variant: requires viewing before confirm
  requireViewForConfirm?: boolean;
  onViewed?: () => void;
}

function getExtFromUrl(fileUrl: string, fileName: string): string {
  // 1. Try extracting from the actual URL path (works for Cloudinary image URLs)
  try {
    const pathname = new URL(fileUrl).pathname;
    // Cloudinary image URLs end like /v123/folder/name.png
    const match = pathname.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    if (match) return match[1].toLowerCase();
    // Also try the last segment split by dot
    const segments = pathname.split("/");
    const last = segments[segments.length - 1];
    const dotIdx = last.lastIndexOf(".");
    if (dotIdx !== -1) return last.substring(dotIdx + 1).toLowerCase();
  } catch {
    // ignore
  }
  // 2. Fallback: check fileName
  const dotIdx = fileName.lastIndexOf(".");
  if (dotIdx !== -1 && dotIdx < fileName.length - 1) {
    return fileName.substring(dotIdx + 1).toLowerCase();
  }
  return "";
}

export function FileViewerModal({
  fileUrl,
  fileName,
  onClose,
  requireViewForConfirm,
  onViewed,
}: FileViewerModalProps) {
  const fullUrl = fileUrl.startsWith("http") ? fileUrl : `${API_BASE}${fileUrl}`;
  const ext = getExtFromUrl(fullUrl, fileName);

  const isImage = ["png", "jpg", "jpeg", "gif", "webp"].includes(ext);
  const isPdf = ext === "pdf";

  const handleLoad = () => {
    if (onViewed) onViewed();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[85vw] h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-4 border-b bg-muted/30 shrink-0 flex flex-row items-center justify-between">
          <div className="space-y-1">
            <DialogTitle className="text-xl">{fileName}</DialogTitle>
            <DialogDescription>
              {ext ? ext.toUpperCase() : "File"} Viewer
              {requireViewForConfirm && (
                <span className="ml-2 text-xs text-amber-600 font-medium">
                  — Please view the file before confirming
                </span>
              )}
            </DialogDescription>
          </div>
          <Button variant="outline" size="sm" asChild className="mr-8 shrink-0">
            <a href={fullUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in External Viewer
            </a>
          </Button>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-muted/10 flex items-center justify-center">
          {isImage ? (
            <img
              src={fullUrl}
              alt={fileName}
              className="max-w-full max-h-full object-contain"
              onLoad={handleLoad}
            />
          ) : isPdf ? (
            <iframe
              src={fullUrl}
              className="w-full h-full border-0"
              title={fileName}
              onLoad={handleLoad}
            />
          ) : (
            // DWG or unsupported: show fallback with external link
            <div className="text-center p-12 bg-background rounded-xl border shadow-sm max-w-sm w-full">
              <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                <FileQuestion className="w-8 h-8" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Preview Not Available</h3>
              <p className="text-sm text-muted-foreground mb-6">
                {ext ? `.${ext.toUpperCase()}` : "This file type"} cannot be previewed directly in the browser.
                Use the button below to open or download it.
              </p>
              <div className="flex flex-col gap-2">
                <Button variant="outline" asChild>
                  <a href={fullUrl} target="_blank" rel="noopener noreferrer" onClick={handleLoad}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in New Tab
                  </a>
                </Button>
                <Button asChild>
                  <a href={fullUrl} download onClick={handleLoad}>
                    <Download className="w-4 h-4 mr-2" />
                    Download File
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
