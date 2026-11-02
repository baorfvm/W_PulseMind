# PulseMind Landing Page

This website serves as a landing page for PulseMind, introducing the project, its purpose, and its clinical decision-support prototype.

## About PulseMind

PulseMind is a clinical decision-support prototype designed for **adult mechanically ventilated patients in intensive care.** It brings together ventilator data, bedside physiological monitoring, laboratory results, and relevant patient context on a shared timeline to estimate the risk of a predefined respiratory event within a specified forecast window and help ICU clinicians identify which patients may need review first and why.

At its core, PulseMind will **stream ventilator telemetry → score it with a model → have an LLM produce a plain-language rationale → surface a prioritised risk board.**

The interface presents each patient’s risk level and trend, key contributing factors, and relevant data-quality limitations, helping clinicians interpret the model output in context rather than relying on a score alone. Review prompts are surfaced visually instead of introducing additional audible alarms.

PulseMind is strictly read-only and clinician-in-the-loop. It does not diagnose patients, recommend treatment, control or modify ventilator settings, replace existing device alarms or bedside monitoring, or make autonomous clinical decisions. All interpretation and clinical action remain with ICU physicians and nurses.

The current system is a research and validation prototype and requires further clinical, technical, workflow, and safety validation before real-world clinical deployment.
