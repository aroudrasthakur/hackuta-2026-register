# Register form components (`src/pages/Register/components`)

Presentational widgets used only by [ApplicationForm](../ApplicationForm.tsx). Not shared with [src/components/](../../../components/README.md).

## Overview

| File | Summary |
| --- | --- |
| [FormFields.tsx](FormFields.tsx) | RequiredMark, FieldError, TextField, SelectField — accessible labeled inputs |
| [formFieldStyles.ts](formFieldStyles.ts) | Tailwind tokens: fieldClass(), fieldsetErrorClass() |
| [SearchableSelect.tsx](SearchableSelect.tsx) | Filterable combobox for school and major lists |
| [CustomCheckbox.tsx](CustomCheckbox.tsx) | CustomCheckbox, CustomRadio — styled controls matching Odyssey theme |
| [ResumeUpload.tsx](ResumeUpload.tsx) | Drag-and-drop PDF picker with client validation |

## Usage

| Component | Used in ApplicationForm for |
| --- | --- |
| TextField, SelectField, FieldError | Name, email, selects, text areas |
| SearchableSelect | School, major |
| CustomCheckbox | Race/ethnicity, dietary, MLH consents |
| CustomRadio | First hackathon yes/no |
| ResumeUpload | Resume PDF |
| formFieldStyles | All of the above + inline fields |

## Tests

| File | Test |
| --- | --- |
| SearchableSelect.tsx | [searchable-select.test.tsx](../../../../tests/unit/searchable-select.test.tsx) |
| ResumeUpload.tsx | [resume-upload.test.tsx](../../../../tests/unit/resume-upload.test.tsx) |

Validation rules: [shared/registration/](../../../../shared/registration/) (e.g. validateResume).

## Related

| Location | Role |
| --- | --- |
| [../README.md](../README.md) | Register flow overview |
| [shared/registration/resume.ts](../../../../shared/registration/resume.ts) | Client resume policy |

Parent index: [../README.md](../README.md).
