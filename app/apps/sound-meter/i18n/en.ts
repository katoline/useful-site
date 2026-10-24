import { manifest } from "../manifest.ts";
import type { Dictionary } from "./types.ts";

export const en = {
  site: { name: manifest.name.en },
  page: {
    title: "Sound Level Meter (Decibel Meter)",
    metaTitle: "Sound Level Meter & Decibel Meter (Free, Measure dB in Your Browser)",
    lead: "Press the button to measure the sound around you with your microphone and see its loudness (dB), main frequency, and frequency breakdown as numbers. Sound is analyzed only on your device and is never recorded or sent.",
    description:
      "A free sound level meter (decibel meter) that measures the noise around you with your phone or computer microphone. See the average, maximum, and L90 level in estimated dB(A), the main frequency and musical note, and the low-to-high frequency breakdown. No install needed, and sound is analyzed only in your browser.",
    appName: "Sound Level Meter (Decibel Meter)",
  },
  measure: {
    start: "Start measuring",
    stop: "Stop",
    again: "Measure again",
    starting: "Preparing the microphone…",
    remaining: "Measuring… {seconds} s left",
    idle: "Press the button to measure the sound around you for {seconds} seconds. The first time, your browser asks for permission to use the microphone.",
    privacy: "Sound is analyzed only on your device. It is never recorded or sent.",
    processing:
      "This device kept its call-oriented audio processing (noise suppression, automatic gain, etc.) on. Readings may differ from the actual level.",
    progress: "Measurement progress",
  },
  live: {
    title: "Right now",
    level: "Loudness",
    peak: "Instant peak",
    frequency: "Main frequency",
    spectrum: "Strength by frequency (50 Hz to 16 kHz)",
    none: "—",
  },
  result: {
    title: "Results",
    weighting: "Frequency weighting {frequency}, time weighting {time}",
    summary: "Measured for {seconds} s ({frames} analyses)",
    leq: "Average (Leq)",
    leqHint: "Energy-averaged level, the standard figure for rating noise",
    max: "Maximum (Lmax)",
    min: "Minimum (Lmin)",
    l10: "L10",
    l10Hint: "Exceeded 10% of the time (the loud moments)",
    l50: "L50",
    l50Hint: "Median",
    l90: "L90",
    l90Hint: "Exceeded 90% of the time (background noise)",
    peak: "Instant peak",
    dominant: "Main frequency",
    note: "Note {name} ({cents} cents)",
    centroid: "Brightness (spectral centroid)",
    centroidHint: "Higher means more high-pitched content",
    bands: "Frequency breakdown",
    noSignal:
      "No sound was received. Check that the microphone isn't muted and that the right microphone is selected.",
    noPitch: "No clear pitch was detected",
    level: "Rough guide",
    csv: "Save CSV",
    dbfs: "{value} dBFS",
  },
  bands: {
    low: "Bass (20–250 Hz)",
    lowMid: "Low mids (250 Hz–1 kHz)",
    highMid: "High mids (1–4 kHz)",
    high: "Treble (4–16 kHz)",
  },
  loudness: {
    veryQuiet: "Very quiet (whisper, suburbs at night)",
    quiet: "Quiet (library, quiet neighborhood by day)",
    moderate: "Moderate (quiet office, soft conversation)",
    lively: "Lively (normal conversation, vacuum cleaner)",
    loud: "Loud (busy street, inside a train)",
    veryLoud:
      "Very loud (subway platform, construction site). Long exposure can strain your hearing",
  },
  settings: {
    title: "Settings",
    duration: "Duration",
    durationValue: "{seconds} s",
    frequencyWeighting: "Frequency weighting",
    frequencyWeightingHint:
      "A matches human hearing (the standard for noise; counts low sounds less). C keeps low sounds almost as they are, and Z applies no weighting. Choose the same one as the meter you compare with.",
    timeWeighting: "Time weighting",
    timeWeightingHint:
      "Fast (0.125 s) follows changes quickly, and Slow (1 s) gives steadier readings. Max and min are taken from this value too.",
    time: {
      fast: "Fast",
      slow: "Slow",
    },
    calibration: "Calibration offset (dB)",
    calibrationHint:
      "Estimated dB = dBFS + offset. On iPhone and iPad the default matches a calibrated sound meter app; on other devices it's a rough value. After a measurement, use “Match a reference” to match your own sound level meter exactly. Saved on this device.",
    reset: "Reset",
  },
  reference: {
    title: "Match a reference (calibrate)",
    hint: "Enter the average (Leq / AVG) from a sound level meter or a calibrated meter app that measured at the same place, at the same time, with the same weighting. The offset is set so this measurement's average matches it, and is used from then on.",
    label: "Reference average ({unit})",
    apply: "Match this value",
  },
  errors: {
    permission:
      "Microphone access was not allowed. Allow the microphone from the address bar or site settings, then try again.",
    notFound: "No microphone was found. Check that a microphone is connected.",
    inUse: "The microphone couldn't be used. Check that no other app is using it.",
    unsupported:
      "This browser can't use the microphone. Try the latest Chrome, Safari, Edge, or Firefox.",
    unknown: "The microphone couldn't be started. Reload the page and try again.",
  },
  faq: {
    title: "FAQ",
    q1: "Is the sound recorded or sent anywhere?",
    a1: "No. The microphone input is analyzed in your browser every 0.1 seconds and turned into numbers. The sound itself is never stored or sent. The microphone turns off automatically when the measurement ends or you stop it.",
    q2: "How accurate are the dB values?",
    a2: "They are estimates. Phone and computer microphones differ in sensitivity and aren't calibrated, so the estimated dB is the level the microphone picks up (dBFS) plus a calibration offset. On iPhone and iPad, the default offset was set by measuring side by side with a calibrated sound meter app; on other devices it's a rough value. If you have a sound level meter or a calibrated app, measure together and enter its value under “Match a reference” below the results to get the same reading. For measurements with legal or contractual weight, use a certified sound level meter.",
    q3: "What do dB(A) and L90 mean?",
    a3: "dB(A) is loudness weighted the way human hearing works (A-weighting), which counts very low and very high sounds less. It's the standard for noise. You can also switch to C-weighting (keeps low sounds almost as they are) or Z (no weighting) in the settings. As in the sound level meter standard (IEC 61672), the displayed level uses Fast (0.125 s) or Slow (1 s) time weighting. L90 is the level exceeded 90% of the time. It leaves out passing sounds such as voices or cars, so it shows the usual background noise of a place.",
    q4: "The readings look wrong or too low.",
    a4: "Some devices can't turn off the noise suppression or automatic gain made for calls, so quiet sounds may read lower than they are. Make sure the microphone hole isn't covered, and check that another microphone, such as Bluetooth earphones, isn't connected.",
  },
} satisfies Dictionary;
