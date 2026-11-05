import { manifest } from "../manifest.ts";
import type { Dictionary } from "./types";

/** UI 文言（英語）。型は ja.ts から作るので、訳し漏れ・余分なキーは型エラーになる */
export const en = {
  site: {
    name: manifest.name.en,
    tagline: "Convert, compress and make icons right in your browser",
    description:
      "Free in-browser tools to convert PNG, JPEG and WebP, compress images and generate favicons. Your images never leave your device.",
  },
  nav: {
    convert: "Convert & Compress",
    icons: "Icon Generator",
    guide: "Guides",
  },
  footer: {
    about: "How to use",
    privacy: "Privacy Policy",
    terms: "Terms & Disclaimer",
    note: "Images are processed in your browser and never uploaded to our server.",
  },
  icons: {
    input: {
      choose: "Choose image",
      change: "Change image",
      drop: "Drag and drop an image here",
      hint: "A square SVG or PNG works best (PNG at 512px or larger).",
      current: "Source: {name} ({width}×{height})",
      fileLabel: "Source image for icons",
    },
    errors: {
      unsupported: "This format can't be read. Please choose an SVG, PNG, JPEG or WebP image.",
      tooLarge: "This image is too large for this device. Please shrink it first.",
      decode: "The image couldn't be loaded. Please check that it isn't corrupted.",
      generate: "The icons couldn't be generated. Please try another image.",
    },
    settings: {
      title: "Adjust",
      padding: "Padding",
      radius: "Corner radius",
      background: "Background color",
      transparent: "Transparent background",
      name: "Site name",
      shortName: "Short name",
      shortNameHint: "Shown under the home screen icon (about 12 characters max).",
      themeColor: "Theme color",
      backgroundColor: "Background color (manifest)",
      backgroundColorHint:
        "Used for the splash screen and behind icons that can't be transparent (apple-touch-icon, maskable, OGP image).",
      includeOg: "Also create an OGP image (1200×630)",
      basePath: "Location",
      basePathHint:
        "Path or URL where you'll put the files (e.g. / or https://example.com/). Used in the HTML.",
      basePathInvalid:
        "Start with / or https:// (./ and ../ also work). The HTML keeps the previous value until this is fixed.",
      siteInfo: "Site info (manifest and HTML)",
    },
    preview: {
      title: "Preview",
      background: "Preview background",
      checker: "Checker",
      white: "White",
      black: "Black",
      small: "16px & 32px",
      actualSize: "Actual size",
      zoomed: "Zoomed",
      tabs: "Browser tabs",
      tabLight: "Light tab",
      tabDark: "Dark tab",
      homeScreen: "Home screen & PWA",
      maskable: "Maskable (cropped to a circle and a rounded square)",
      og: "OGP image",
      empty: "Choose an image to see the preview.",
      generating: "Generating…",
    },
    output: {
      title: "Save",
      download: "Save as ZIP",
      files: "Files included ({count})",
      snippet: "HTML for your <head>",
      copy: "Copy",
      copied: "Copied",
      copyFailed: "Couldn't copy. Please select the text and copy it.",
      ogNote:
        "og:image must be an absolute URL starting with https://. Enter a URL as the location, or add your domain after pasting.",
    },
    howto: {
      title: "How to use",
      step1: "Choose a source image (a square SVG or a PNG of 512px or more works best).",
      step2:
        "Adjust padding, background and corner radius, and check the 16px, 32px and browser tab previews for lost detail.",
      step3: "Enter your site name and theme color, then click “Save as ZIP”.",
      step4: "Upload the files to your site and paste the HTML shown into your <head>.",
    },
    faq: {
      title: "FAQ",
      q1: "Are my images uploaded to a server?",
      a1: "No. All icons are generated inside your browser.",
      q2: "Which sizes are inside favicon.ico?",
      a2: "16×16, 32×32 and 48×48, stored as PNG. Every major browser can display it.",
      q3: "What is a maskable icon?",
      a3: "A PWA icon that Android and others crop to a circle or rounded square. Padding is added automatically so the image fits in the central safe zone (80% diameter) and isn't cut off.",
      q4: "Will my icon be hard to see on dark tabs?",
      a4: "The preview shows both light and dark tab colors. If a dark logo disappears, add a background color, or use padding and a corner radius to frame it.",
    },
  },
  pwa: {
    manifest: {
      name: "Image Adjust - Convert & Compress Images",
      shortName: "Image Adjust",
      description:
        "Free in-browser tool to convert PNG, JPEG and WebP, compress images and generate favicons.",
    },
    updateAvailable: "A new version is available.",
    updatedElsewhere: "The app was updated in another tab. Please reload.",
    reload: "Reload",
    dismiss: "Dismiss",
    install: "Install app",
    installHint: "Add it to your home screen to use it offline.",
    iosInstallHint:
      'In Safari, tap the Share button and choose "Add to Home Screen" to use it as an app.',
    receivedFiles: "Received {count} file(s).",
  },
  content: {
    updated: "Updated: {date}",
    readMore: "Read article",
  },
  legal: {
    externalTransmission: "External data transmission",
  },
  pages: {
    home: {
      title: "Image Converter & Compressor",
      metaTitle: "Image Converter & Compressor (PNG / JPEG / WebP)",
      description:
        "Convert between PNG, JPEG and WebP and compress JPEG / PNG / WebP / GIF / SVG in your browser. No uploads.",
      lead: "Pick images and they are converted and compressed right in your browser.",
    },
    convert: {
      title: "Convert {from} to {to}",
      metaTitle: "Convert {from} to {to} (Free, In-Browser)",
      description:
        "Free tool to convert {from} images to {to}. Processing happens in your browser, so nothing is uploaded.",
      lead: "Pick {from} images to convert them to {to}.",
    },
    compress: {
      title: "Compress {format}",
      metaTitle: "Compress {format} Images (Free, In-Browser)",
      description:
        "Free tool to reduce {format} file size. Set quality, a target size or resize dimensions.",
      lead: "Pick {format} images to compress them.",
    },
    icons: {
      title: "Web Icon Generator",
      metaTitle: "Favicon & Icon Set Generator",
      description:
        "Generate favicon.ico, apple-touch-icon, PWA icons and an OGP image from a single image.",
      lead: "Pick a source image to generate every icon your website needs.",
    },
    guide: {
      title: "Guides",
      description: "Guides on choosing image formats, setting up favicons and more.",
      articles: {
        "image-formats": "Choosing an Image Format",
        "favicon-setup": "How to Set Up Favicons",
        "optimize-lp-images": "Making Landing Page Images Lighter",
      },
    },
    about: {
      title: "How to Use Image Adjust",
      description: "How to use Image Adjust and what makes it different.",
    },
    privacy: {
      title: "Privacy Policy",
      description:
        "Image Adjust privacy policy, including disclosures about external data transmission.",
    },
    terms: {
      title: "Terms & Disclaimer",
      description: "Image Adjust terms of use and disclaimer.",
    },
  },
  tool: {
    input: {
      choosePhotos: "Choose photos",
      chooseFiles: "Choose files",
      chooseFolder: "Choose a folder",
      chooseZip: "Choose a ZIP",
      dropHint: "Drop images, folders or a ZIP here",
      dropOr: "or",
      acceptNote:
        "PNG / JPEG / WebP / GIF / SVG, or a ZIP (folder structure is kept). Images never leave your device.",
      urlLabel: "Image URL",
      urlPlaceholder: "https://example.com/image.png",
      urlAdd: "Add from URL",
      urlSubmit: "Add",
      urlLoading: "Fetching…",
      urlOffline: "You are offline, so images cannot be fetched from a URL",
      urlErrors: {
        invalid_url: "That is not a valid URL (http / https only)",
        forbidden_host: "Images cannot be fetched from this URL",
        too_large: "The image is too large (URL input is limited to 25 MB)",
        not_image: "That does not look like an image",
        timeout: "Fetching the image timed out",
        rate_limited: "Too many requests. Please wait a moment and try again",
        upstream_error: "The remote server returned an error",
        network: "Network error while fetching the image",
      },
    },
    settings: {
      title: "Settings",
      open: "Open settings",
      done: "Done",
      output: "Output format",
      outputSame: "Keep original format",
      sizeMode: "How to size",
      modeQuality: "Quality",
      modeTarget: "Target size",
      quality: "Quality",
      presetHigh: "High",
      presetStandard: "Standard",
      presetLight: "Light",
      targetSize: "Target file size (KB or less)",
      targetNote: "Quality is binary-searched to find the highest quality at or below the target.",
      resize: "Resize",
      resizeNone: "None",
      resizePx: "px",
      resizePercent: "%",
      width: "Width",
      height: "Height",
      keepAspect: "Keep aspect ratio",
      noEnlarge: "Never enlarge",
      percent: "Scale",
      jpegBackground: "JPEG background (for transparent areas)",
      jpegProgressive: "Progressive JPEG",
      pngLossless: "Do not reduce PNG colors (lossless)",
      pngNote: "When reducing colors, “Quality” maps to the number of colors (2–256).",
      webpLossless: "Lossless WebP",
      gifLevel: "GIF optimization level",
      gifLossy: "GIF lossiness",
      gifColors: "GIF colors",
      gifColorsKeep: "Keep",
      svgLevel: "SVG optimization",
      svgSafe: "Safe",
      svgStandard: "Standard",
      svgAggressive: "Aggressive",
      svgNote: "Safe: only removes metadata and comments. Aggressive: rounds numeric precision.",
      stripMetadata: "Remove EXIF and other metadata",
      stripMetadataNote:
        "Pixels are re-encoded, so PNG / JPEG / WebP metadata cannot be preserved even when this is off.",
      preset: "Web presets",
      presetNone: "None (manual)",
      presets: {
        "lp-hero": "Landing page hero (1920 wide / WebP / under 300 KB)",
        "blog-thumb": "Blog thumbnail (1200 wide / WebP)",
        "og-image": "OGP image (1200 wide / JPEG)",
        responsive: "Responsive (640 / 1280 / 1920 WebP)",
      },
      responsiveWidths: "Responsive export widths",
      responsiveNote:
        "Only widths smaller than the original are exported, with a <picture> / srcset snippet.",
      advanced: "Advanced",
    },
    results: {
      title: "Results",
      empty: "Results will appear here once you choose images.",
      status: {
        queued: "Queued",
        processing: "Processing",
        done: "Done",
        error: "Error",
        skipped: "Skipped",
      },
      summary: "{count} files: {before} → {after}",
      progress: "{done} / {total} processed",
      reduction: "{percent}% smaller",
      increase: "{percent}% larger",
      unchanged: "Unchanged",
      save: "Save",
      share: "Share",
      shareHint: "Use Share → “Save Image” to save to your photo library",
      compare: "Compare",
      remove: "Remove",
      clearAll: "Clear all",
      saveAll: "Save all as ZIP",
      saveAllParts: "Save all as ZIP ({n} parts)",
      savePart: "Save part {n} / {total}",
      partsNote: "The output is large, so it is split into {n} ZIP files. Save them one at a time.",
      partSaved: "Saved",
      saving: "Building ZIP…",
      snippet: "HTML snippet",
      snippetTitle: "<picture> / srcset snippet",
      copy: "Copy",
      copied: "Copied",
      quality: "Quality {quality}",
      variant: "{width} wide",
      warnings: {
        target_unreachable: "Could not reach the target size (this is the lowest-quality result)",
        metadata_dropped: "Metadata is not preserved because the image was re-encoded",
        gif_kept: "GIF cannot be converted to another format, so it was optimized as GIF",
        svg_kept: "SVG cannot be converted or resized, so it was optimized as SVG",
        kept_original: "The result was not smaller, so the original data was kept",
        animated_webp:
          "Animated WebP is not supported, so the original was kept (metadata removed only)",
      },
      errors: {
        unsupported: "Unsupported format (PNG / JPEG / WebP / GIF / SVG only)",
        too_many_pixels: "This image is too large for this device. Try on a PC, or resize it first",
        decode_failed: "The image could not be decoded (it may be corrupt or unsupported)",
        encode_failed: "Conversion failed",
        file_too_large: "The file is too large (limit on this device: {limit})",
        zip_too_large: "The ZIP is too large (limit on this device: {limit})",
        zip_total_too_large: "Stopped: the extracted size of the ZIP exceeded the limit",
        zip_too_many_entries: "Stopped: the ZIP contains more files than the limit",
        zip_read_failed: "The ZIP could not be read",
        zip_write_failed: "Writing the ZIP failed",
        share_failed: "Sharing failed",
        cancelled: "Cancelled",
      },
    },
    compare: {
      title: "Before / after",
      description: "Drag the slider to compare the original (left) with the result (right).",
      before: "Before",
      after: "After",
      background: "Background",
      checker: "Checker",
      white: "White",
      black: "Black",
      slider: "Compare position",
      outputWidth: "Output width",
      loading: "Loading the original image…",
      loadFailed: "Could not load the original image",
    },
    faq: {
      title: "FAQ",
      howTo: "How to use",
      steps: {
        "1": "Choose images (PNG / JPEG / WebP / GIF / SVG), or a folder or ZIP containing images.",
        "2": "Pick the output format and set quality, target size or resize. Changing a setting reprocesses automatically.",
        "3": "Use “Save” on each result, or “Save all as ZIP” for everything at once.",
      },
      home: {
        q1: "Are my images uploaded to a server?",
        a1: "No. All conversion and compression runs in your browser (WebAssembly); images are never sent to our server. Only URL input fetches the given URL through our server.",
        q2: "How many images can I process at once?",
        a2: "There is no limit on the number of files. Each image has a per-device limit on pixels and file size; files over the limit are skipped with a notice.",
        q3: "What happens to EXIF and other metadata?",
        a3: "It is removed by default, so location data and similar details do not end up in the output.",
      },
    },
    device: {
      limitNote: "Limits on this device: {pixels} MP per image, up to {file} per file",
    },
  },
  convert: {
    detailsTitle: "Converting {from} to {to}: what to know",
    guideLead: "For a closer look at each format and when to use it, see the guide:",
    details: {
      "png-to-jpeg": {
        s1: {
          title: "When to convert to JPEG",
          body: "Phone screenshots and photos exported from editing software as PNG often weigh several megabytes. Photographic images, where colors change subtly from pixel to pixel, are exactly what JPEG's lossy compression is good at: at around quality 80 the file commonly shrinks to a fraction of its size. For email attachments, blog or social media posts, or upload forms with a size limit, JPEG is the easy choice.\n\nLogos, icons, text-heavy diagrams and UI screenshots are a different story. JPEG tends to add fuzzy noise around sharp edges (mosquito noise), and the file barely gets smaller. Keep images like these as PNG and compress them, or try converting to WebP instead.",
        },
        s2: {
          title: "What changes in the conversion",
          body: "JPEG has no transparency, so transparent and semi-transparent areas are blended onto the “JPEG background” color (white by default). Anti-aliased edges are mixed with that color too, so if the image will sit on a dark page, set the background to match and the edges won't show a light halo. If the PNG carries an ICC profile (color space information), it is embedded again in the JPEG so the colors stay the same. Other metadata, such as text chunks, is dropped when the image is re-encoded.",
        },
        s3: {
          title: "Recommended settings",
          body: "Start with “Standard” quality (80), then use “Compare” on the result to zoom in and check for visible artifacts. “Progressive JPEG” is on by default; it shows a coarse version of the whole image while it loads, which suits the web. If the destination has a limit such as “under 500 KB”, choose “Target size” and the tool finds the highest quality that fits. Images rarely need more pixels than the screen they're shown on, so resizing to around 1920px wide under “Advanced” usually shrinks the file more gracefully than lowering the quality.",
        },
      },
      "png-to-webp": {
        s1: {
          title: "How much smaller WebP gets",
          body: "WebP has both a lossless and a lossy mode, and both support transparency. For PNGs with few colors and crisp edges, such as logos, diagrams and screenshots, turning on “Lossless WebP” typically makes the file 20–30% smaller than the PNG without changing a single pixel. For photos or PNGs full of gradients, lossy WebP at quality 75–85 can cut the size to a fraction. Keeping transparency while getting JPEG-like file sizes is something neither PNG nor JPEG can do, and it is WebP's main strength.",
        },
        s2: {
          title: "What changes, and what to watch for",
          body: "Transparent and semi-transparent areas are kept in both lossless and lossy mode. In lossy mode, WebP stores color information at reduced resolution, just like JPEG, so the edges of thin red or blue text and lines can blur slightly. For images where text matters, choose lossless or check the result with “Compare”. Also note that WebP is limited to 16383px in width and height. Very tall images such as full-page screenshots exceed this and fail to convert, so resize them first.",
        },
        s3: {
          title: "Recommended settings",
          body: "For images on a website, pick 640, 1280 and 1920px under “Responsive export widths” in “Advanced”. The tool exports WebP versions at each width smaller than the original and creates a <picture> / srcset HTML snippet. The “Landing page hero” preset sets everything up for a 1920px-wide WebP under 300 KB in one step. All current major browsers display WebP, but if the image may go to a print service or older editing software that does not accept WebP, keep the original PNG as well.",
        },
      },
      "jpeg-to-png": {
        s1: {
          title: "Why convert to PNG",
          body: "Converting a JPEG to PNG does not bring back the detail lost to JPEG compression, nor remove its blocky noise. Where PNG helps is when you will edit and save the image many times. A JPEG is recompressed and degrades a little with every save, whereas a lossless PNG stays exactly the same no matter how often you save it. PNG suits editing software or submission services that only accept PNG, and working copies for cut-outs or adding text. Note that converting to PNG does not make the background transparent: a white background stays as white pixels.",
        },
        s2: {
          title: "Default color reduction and the lossless option",
          body: "By default, this tool's PNG output reduces the number of colors according to the quality value. At quality 80 the image is mapped to a palette of about 100 colors, with dithering to represent in-between shades (quality 100 does not reduce colors). To keep a photo's smooth tones intact, turn on “Do not reduce PNG colors (lossless)” under “Advanced”. No color is changed, but the file is usually several times larger than the original JPEG. Conversely, when you receive an illustration or chart with few colors as a JPEG, reducing colors gives you a smaller PNG.",
        },
        s3: {
          title: "Camera data and photo orientation",
          body: "JPEGs from phones and digital cameras often contain EXIF data such as the date, camera model and GPS location. Converting to PNG removes it, so the output cannot reveal where the photo was taken. The EXIF orientation flag, which tells viewers to rotate the photo, is applied to the pixels before saving, so the converted image will not end up sideways. Color information (the ICC profile) is embedded again in the PNG.",
        },
      },
      "jpeg-to-webp": {
        s1: {
          title: "Lighter photos for the web",
          body: "Converting JPEG to WebP is a standard way to make a website load faster. At the same visual quality, WebP is typically 25–35% smaller than JPEG, and the savings add up on photo-heavy pages. If you want to improve Largest Contentful Paint (LCP), one of the Core Web Vitals, converting hero images and featured images to WebP is one of the most effective steps.",
        },
        s2: {
          title: "Choosing the quality",
          body: "The source JPEG is already lossy, so converting it to WebP is a second round of lossy compression. Raising the quality too far cannot make it look better than the original JPEG and only makes the file larger, so quality 75–85 is a good range. “Lossless WebP” tries to preserve the JPEG's noise exactly and almost always ends up larger than the original JPEG, so it is not suited to photos. If there is a size limit, use “Target size”; for oversized photos, add a resize to around 1920px wide to shrink the file with minimal loss.",
        },
        s3: {
          title: "Metadata and publishing",
          body: "The conversion removes EXIF data (date, location and so on) and keeps only color information (the ICC profile). The camera's orientation flag is applied to the pixels, so photos keep the right rotation. All current major browsers display WebP, but for photos sent by email or used for printing, JPEG is still the safer choice. When you use WebP on a website, keep the original JPEG too; if needed, a <picture> element can list the JPEG as a fallback.",
        },
      },
      "webp-to-png": {
        s1: {
          title: "When to convert to PNG",
          body: "It is increasingly common for an image downloaded from the web to turn out to be WebP. If you need it in image editors that cannot open WebP, or in upload forms and document tools that only accept PNG or JPEG, converting to PNG is the reliable option because it keeps transparency. Lossless PNG is also a good choice for saving work in progress without degrading it.\n\nSome websites serve WebP data even when the file name ends in .png or .jpg. This tool detects the format from the file's contents rather than its extension, so such images convert to PNG as they are.",
        },
        s2: {
          title: "What changes in the conversion",
          body: "Transparent and semi-transparent areas become the PNG's alpha channel (its transparency information) unchanged. If the source WebP was lossy, however, its noise and blurring are copied into the PNG as well, so the image does not get any better. The file is usually larger than the original WebP. Animated WebP is not supported for conversion; it is output as WebP with only its metadata removed.",
        },
        s3: {
          title: "Recommended settings",
          body: "By default, this tool's PNG output reduces the number of colors according to the quality (about 100 colors at quality 80). For illustrations and icons the difference is barely visible and the file stays small. For photos, or images you plan to edit further, turn on “Do not reduce PNG colors (lossless)” under “Advanced”. Color information (the ICC profile) in the source WebP is embedded again in the PNG, while EXIF and other metadata are removed.",
        },
      },
      "webp-to-jpeg": {
        s1: {
          title: "When to convert to JPEG",
          body: "WebP is an excellent format for the web, but for social media posts, email attachments, photo prints and print submissions, or pasting into older spreadsheet and presentation software, JPEG is still the format that works everywhere. When you want a photo-like WebP in a form anyone can open, JPEG is the right choice. For logos that need transparency, or images made mostly of text and lines, convert to PNG instead.",
        },
        s2: {
          title: "Transparency and quality",
          body: "JPEG cannot store transparency, so transparent and semi-transparent areas are filled with the “JPEG background” color (white by default). Semi-transparent edges blend with that color too, so if the image will be placed on a dark background, match the color to it. If the source WebP is lossy, converting to JPEG is a second round of lossy compression and the losses add up. A slightly higher quality of 85–90 keeps the degradation hard to notice. Animated WebP is not supported for conversion and is output as WebP.",
        },
        s3: {
          title: "Recommended settings",
          body: "“Progressive JPEG” is on by default. It lets the whole image appear while loading, so it is fine to leave on for the web too. For destinations with a file size limit, enter the limit in KB under “Target size” and the tool finds the highest quality below it. To make the OGP image shown when a link is shared on social media, the “OGP image” preset (1200px wide, JPEG at quality 85) is handy. EXIF and other metadata are removed, while color information (the ICC profile) is kept.",
        },
      },
    },
    intro: {
      "png-to-jpeg":
        "Converting PNG to JPEG greatly reduces file size for photo-like images. Transparent areas are filled with the background color you choose (white by default).",
      "png-to-webp":
        "WebP supports transparency like PNG and is typically 20–50% smaller at the same visual quality. Lossless mode is available too.",
      "jpeg-to-png":
        "Converting JPEG to PNG stops further quality loss during editing. The file will be larger.",
      "jpeg-to-webp":
        "Converting JPEG to WebP cuts file size by roughly 25–35% at the same quality. All major browsers support WebP.",
      "webp-to-png":
        "Convert WebP to PNG for software that does not support WebP, or when you need a lossless format for editing. Transparency is preserved.",
      "webp-to-jpeg":
        "Converting WebP to JPEG makes the image usable in older software and on social networks. Transparent areas are filled with the chosen background color.",
    },
    faq: {
      "png-to-jpeg": {
        q1: "What happens to transparent areas?",
        a1: "JPEG has no transparency, so they are filled with the “JPEG background” color in settings. The default is white.",
        q2: "Which quality should I use?",
        a2: "For photos, quality 75–85 is visually almost indistinguishable. Images with lots of text or lines are better as PNG or WebP.",
        q3: "Can the JPEG be larger than the original PNG?",
        a3: "Yes, for flat illustrations or screenshots with few colors. In that case try converting to WebP instead.",
      },
      "png-to-webp": {
        q1: "Is transparency preserved?",
        a1: "Yes. WebP supports an alpha channel just like PNG.",
        q2: "Should I pick lossless or lossy?",
        a2: "Use lossless for logos and diagrams that must not degrade, and lossy (quality around 80) for photos.",
        q3: "Do all browsers support WebP?",
        a3: "Current Chrome, Safari, Firefox and Edge all do. For older environments, provide a JPEG / PNG fallback with <picture>.",
      },
      "jpeg-to-png": {
        q1: "Does converting to PNG improve quality?",
        a1: "No. Detail lost by JPEG compression cannot be recovered. The benefit is that further edits and saves no longer degrade the image.",
        q2: "Why is the file larger?",
        a2: "PNG is lossless, so photos become several times larger than the JPEG. Reducing “PNG colors” makes the file smaller.",
        q3: "What happens to EXIF (camera and location data)?",
        a3: "It is removed by default, so the location where the photo was taken is not included in the output.",
      },
      "jpeg-to-webp": {
        q1: "How much smaller will it be?",
        a1: "Typically 25–35% smaller at the same visual quality. You can also set a target size and let the tool find the quality automatically.",
        q2: "Is there any quality loss?",
        a2: "Re-encoding a lossy format loses a little detail, but at quality around 80 the difference is rarely noticeable.",
        q3: "Can I convert iPhone photos (HEIC)?",
        a3: "Not yet. Set your iPhone camera to “Most Compatible” to export JPEG, then convert.",
      },
      "webp-to-png": {
        q1: "Is transparency preserved?",
        a1: "Yes. WebP transparency becomes the PNG alpha channel.",
        q2: "Can I convert animated WebP?",
        a2: "Not at the moment. Animated WebP files are not converted: they are output as the original WebP (with only metadata removed), and a notice is shown.",
        q3: "Why is the file larger?",
        a3: "PNG is lossless, so it is larger than WebP. Reducing “PNG colors” makes the file smaller.",
      },
      "webp-to-jpeg": {
        q1: "What happens to transparent areas?",
        a1: "JPEG has no transparency, so they are filled with the “JPEG background” color in settings. The default is white.",
        q2: "What quality will I get?",
        a2: "At quality 80–90 the difference is barely visible, although re-encoding loses a little detail.",
        q3: "Which format is best for social media?",
        a3: "Most social networks expect JPEG or PNG, so converting to JPEG is the safe choice.",
      },
    },
  },
  compress: {
    detailsTitle: "Compressing {format}: what to know",
    guideLead: "For a step-by-step approach to lighter web page images, see the guide:",
    details: {
      jpeg: {
        s1: {
          title: "How JPEG compression works",
          body: "JPEG is a lossy format that splits an image into 8×8 pixel blocks and discards fine detail the eye is unlikely to notice. “Quality” controls how much is discarded: the lower it is, the smaller the file, but blocky noise and blurred edges start to appear. This tool uses MozJPEG, an efficient encoder developed by Mozilla, which optimizes the entropy coding and uses progressive encoding to produce smaller files than typical software at the same quality value.",
        },
        s2: {
          title: "Recommended settings",
          body: "For photos, quality 75–85 is a good range; at “Standard” (80), differences are usually invisible unless you zoom in. If the destination has a limit such as “under 200 KB”, choose “Target size” and the tool searches for the highest quality that fits. Resizing has the biggest effect. Scaling a phone photo (around 4000px wide) down to 1920px leaves only about a quarter of the pixels, cutting the file size dramatically with almost no loss of quality. EXIF data such as GPS location is removed by default.",
        },
        s3: {
          title: "When the file does not get smaller",
          body: "Re-saving a JPEG that was already stored at low quality with quality 80 can make it larger. When the result is larger than the original, this tool outputs the original data (with only the metadata removed) and tells you it was not smaller. In that case, lower the quality or add a resize. JPEG also degrades a little more with every re-save, so keep your uncompressed original and always export from it. Images made mostly of text or diagrams are a poor fit for JPEG in the first place; if you still have the source, saving it as PNG or WebP gives a cleaner, smaller result.",
        },
      },
      png: {
        s1: {
          title: "How PNG compression works",
          body: "PNG is a lossless format that stores every pixel exactly. It records differences from neighboring pixels and then compresses them with Deflate, the same method ZIP uses. This tool shrinks PNGs in two stages. First, color reduction: libimagequant maps the colors to a palette of up to 256, using dithering to represent in-between shades. Second, OxiPNG repacks the file, choosing better filters and compression settings to trim data without changing how it looks. Screenshots and illustrations benefit greatly from color reduction and often end up less than half their original size.",
        },
        s2: {
          title: "Recommended settings",
          body: "For PNG, “Quality” maps to the number of colors: about 160 colors at “High” (90), about 100 at “Standard” (80) and about 40 at “Light” (60); quality 100 does not reduce colors. Transparency, including partial transparency, is kept after color reduction. For material where no pixel may change (pixel art, images for visual comparison, print masters), turn on “Do not reduce PNG colors (lossless)”. Only OxiPNG's repacking is applied then, so savings are limited to a few percent up to a few tens of percent. “Target size” automatically finds the largest number of colors that fits under the target.",
        },
        s3: {
          title: "When the file does not get smaller",
          body: "Photos saved as PNG contain too many colors to shrink much with color reduction, and reducing colors tends to add banding or grain to gradients. Photos get far smaller as JPEG or WebP; you can try this just by changing the output format. PNGs that were already reduced and optimized by another tool may not get any smaller. In that case, the original data is output and the tool tells you it was not smaller. If the resolution is much larger than the size the image is displayed at, consider resizing too.",
        },
      },
      webp: {
        s1: {
          title: "How WebP compression works",
          body: "WebP, developed by Google, has two modes: lossy and lossless. Lossy WebP is based on the VP8 video codec; it predicts each block from its neighbors and stores only the difference, which compresses photos more efficiently than JPEG. Lossless WebP keeps every pixel and uses a color cache and back-references to repeated areas to store images more compactly than PNG. Both modes support transparency. This tool re-encodes images with Google's libwebp.",
        },
        s2: {
          title: "Recommended settings",
          body: "For photos, lossy mode at quality 75–85 is a good range. For logos, icons, text-heavy diagrams and UI screenshots, turning on “Lossless WebP” keeps edges sharp. “Target size” searches for a lossy quality, so the lossless setting is not used while a target size is set. Resizing images that are larger than their display size is the most effective step, and choosing “Responsive export widths” under “Advanced” produces 640, 1280 and 1920px versions together with srcset HTML.",
        },
        s3: {
          title: "When the file does not get smaller",
          body: "WebP images downloaded from the web are often already heavily compressed by the site that served them, so re-saving at quality 80 may not make them smaller. In that case the original data is output and the tool tells you it was not smaller; lower the quality or resize instead. Re-saving a lossy WebP as lossless makes it larger, because the encoder tries to preserve the noise exactly. Animated WebP is not supported yet; it is output unchanged apart from removing its metadata.",
        },
      },
      gif: {
        s1: {
          title: "How GIF compression works",
          body: "GIF stores each frame with a palette of up to 256 colors and a lossless compression method called LZW, and plays several frames in sequence as an animation. This tool uses gifsicle to shrink GIFs in three ways while keeping the number, order and timing of frames: “optimization”, which keeps only the parts that changed from the previous frame; “lossy” compression, which evens out runs of similar colors so LZW works better; and “color reduction”, which shrinks the palette.",
        },
        s2: {
          title: "Recommended settings",
          body: "The default optimization level of 2 is usually enough. Level 3 tries more methods, but on large GIFs it takes much longer for only a small gain. Lossiness defaults to 30, and 30–60 is a good balance between size and quality; higher values shrink the file further but add a sandy noise. Colors default to “Keep”; reducing to 64 or 32 colors can cut the size a lot, although gradients become coarser. Resizing has the biggest effect: halving the width and height leaves a quarter of the pixels, and that applies to every frame.",
        },
        s3: {
          title: "When the file does not get smaller",
          body: "GIFs that have already been optimized may not get any smaller. In that case the original data is output and the tool tells you it was not smaller; raise the lossiness, reduce the colors or resize. GIFs made from live-action video, where the whole frame changes every time, gain little from frame optimization and hit the limits of the format. This tool cannot convert GIF to other formats, but for use on a website, a video format such as MP4 or WebM is far smaller.",
        },
      },
      svg: {
        s1: {
          title: "How SVG compression works",
          body: "SVG describes shapes as XML text, so there is no notion of image quality: the less unnecessary markup, the smaller the file. SVGs exported from Illustrator, Inkscape and similar tools contain editor-specific attributes, metadata, comments, hidden elements and needlessly precise decimals. This tool removes these with SVGO and rewrites path data in a shorter form. Files often shrink to less than half their size without any visible change.",
        },
        s2: {
          title: "The three optimization levels",
          body: "“Safe” only removes metadata, comments and editor-specific attributes, leaving shapes and ids untouched. “Standard” (the default) runs SVGO's standard set of optimizations repeatedly, rewriting paths and removing or shortening unused ids. “Aggressive” additionally rounds numbers to two decimal places. If CSS or JavaScript targets elements by id, or the file is a sprite referenced from HTML with <use>, changed ids will break its appearance or behavior, so choose “Safe”. The viewBox is kept at every level.",
        },
        s3: {
          title: "When the file does not get smaller",
          body: "An SVG that has already been optimized is output as the original data, and the tool tells you it was not smaller. If the SVG embeds a photo or other bitmap (a long Base64 string), SVGO cannot shrink that part. SVGs whose paths are inherently huge, such as logos with text converted to outlines or detailed traced images, also gain less. Because SVG is text, serving it with gzip or Brotli compression from the server cuts the transfer size to a fraction again. There is no target size or resize for SVG: it scales up and down without any loss, which is the point of the format.",
        },
      },
    },
    intro: {
      jpeg: "Re-encodes with MozJPEG to shrink JPEG files while keeping the same look. Set a quality, a target size (e.g. under 200 KB) or a resize.",
      png: "Re-packs PNG losslessly with OxiPNG and optionally reduces the number of colors (quantization) to make it smaller. Transparency is preserved.",
      webp: "Re-encodes with libwebp to make WebP smaller. Choose lossy quality or lossless compression.",
      gif: "Uses gifsicle to optimize frame differences, reduce colors and apply lossy compression, keeping every frame of animated GIFs.",
      svg: "Uses SVGO to strip metadata, comments and editor-specific attributes, and rounds numeric precision to shrink SVG files.",
    },
    faq: {
      jpeg: {
        q1: "Can I shrink a JPEG without losing quality?",
        a1: "MozJPEG encodes efficiently, so files often get smaller even at the same quality setting. At quality around 80 the difference is rarely visible.",
        q2: "What if the target size cannot be reached?",
        a2: "If even the lowest quality is too large, that result is shown with a “target not reached” notice. Adding a resize usually gets you there.",
        q3: "What is a progressive JPEG?",
        a3: "A JPEG that displays a blurry version of the whole image while loading. It is on by default for the web.",
      },
      png: {
        q1: "Does reducing colors lower the quality?",
        a1: "Images are limited to 256 colors, so photos with smooth gradients may show a difference. Illustrations and screenshots are usually indistinguishable. You can also choose lossless.",
        q2: "Is transparency preserved?",
        a2: "Yes, including partial transparency, even after color reduction.",
        q3: "How do I make a photo PNG smaller?",
        a3: "PNG is not suited for photos. Consider converting to JPEG or WebP instead.",
      },
      webp: {
        q1: "What is the difference between lossless and lossy?",
        a1: "Lossless keeps every pixel exactly (logos, diagrams). Lossy lets you set a quality for much smaller files (photos).",
        q2: "Can I compress animated WebP?",
        a2: "Not at the moment. Animated WebP files are left uncompressed and output as they are (with only metadata removed), and a notice is shown.",
        q3: "Can I set a target size?",
        a3: "Yes. Choose “Target size”, enter a KB value, and the highest quality at or below it is found automatically.",
      },
      gif: {
        q1: "Is the animation preserved?",
        a1: "Yes. Frame count, order and timing are kept; size is reduced by optimizing frame differences and reducing colors.",
        q2: "What lossiness should I use?",
        a2: "30–60 is a good balance. Higher values show more visible noise.",
        q3: "Is optimization level 3 slow?",
        a3: "On large GIFs it can take very long and barely beats levels 1–2. Level 2 is enough for most files.",
      },
      svg: {
        q1: "Can the appearance change?",
        a1: "“Safe” only removes metadata and comments, so nothing changes. “Aggressive” rounds numeric precision and can occasionally alter fine details.",
        q2: "Can I set a target size?",
        a2: "SVG is text, so there is no continuous quality setting. Choose one of three optimization levels instead.",
        q3: "Is the SVG preview safe?",
        a3: "Previews are shown through an <img> element, so scripts inside the SVG never run.",
      },
    },
  },
} satisfies Dictionary;
