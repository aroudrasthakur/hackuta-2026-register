import { useConvexAuth } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { SavedResumeDraft } from "../../../shared/registration/applicantFields";
import { formToDraftPatch } from "../../../shared/registration/draftPatch";
import {
  getMyApplicationDraftRef,
  saveApplicationDraftRef,
} from "../../convex/api";
import { isMockApiEnabled } from "../../constants/mockAuth";
import { getConvexClient } from "../../convex/client";
import { useSessionAuth } from "../../hooks/useSessionAuth";
import { OdysseyButton } from "../../components/OdysseyButton";
import { useApplicantRouting } from "../../hooks/useApplicantRouting";
import {
  checkboxFieldsetClass,
  checkboxGridClass,
  fieldClass,
  fieldsetErrorClass,
  fieldsetLegendClass,
  inlineRadioGroupClass,
  inputClass,
  labelClass,
  legendClass,
} from "./components/formFieldStyles";
import {
  APPLICATION_QUESTIONS,
  COUNTRIES_OF_RESIDENCE,
  DIETARY_OPTIONS,
  EXPERIENCE_LEVELS,
  FIELD_LIMITS,
  FOOD_ALLERGY_WAIVER_TEXT,
  GENDERS,
  HEAR_ABOUT_OPTIONS,
  HEAR_ABOUT_OTHER_OPTION,
  LEVELS_OF_STUDY,
  MAJOR_OTHER_OPTION,
  MAJORS,
  SCHOOL_OTHER_OPTION,
  SPONSOR_SHARING_CONSENT_TEXT,
  MAX_GRADUATION_YEAR,
  MAX_HACKATHONS_ATTENDED,
  MIN_GRADUATION_YEAR,
  MIN_HACKATHONS_ATTENDED,
  MLH_CODE_OF_CONDUCT_URL,
  MLH_PRIVACY_POLICY_URL,
  MLH_SCHOOLS,
  MLH_TEXAS_SCHOOLS,
  RACE_ETHNICITY_OPTIONS,
  TSHIRT_SIZES,
} from "./constants";
import {
  FieldError,
  SelectField,
  TextAreaField,
  TextField,
} from "./components/FormFields";
import { SearchableSelect } from "./components/SearchableSelect";
import { CustomCheckbox, CustomRadio } from "./components/CustomCheckbox";
import { ResumeUpload } from "./components/ResumeUpload";
import {
  discardResumeUpload,
  submitRegistration,
  uploadResume,
  type ResumeUploadSession,
} from "./registerApi";
import type {
  ApplicationFormData,
  FieldName,
} from "../../../shared/registration/types";
import {
  normalizeResidenceFormFields,
  requiresUsState,
  US_STATE_OPTIONS,
} from "../../../shared/registration/residence";
import { INITIAL_FORM } from "../../../shared/registration/types";
import {
  RESUME_MISSING_MESSAGE,
  resumeFileKey,
} from "../../../shared/registration/resume";
import {
  DRAFT_SAVE_ERROR_MESSAGE,
  isResumeFieldMessage,
  mapConvexErrorToUserMessage,
  mapUploadError,
  RESUME_REMOVE_ERROR_MESSAGE,
  RESUME_UPLOAD_ERROR_MESSAGE,
  SIGN_IN_REQUIRED_MESSAGE,
} from "../../../shared/registration/submitErrors";
import {
  focusFirstInvalidField,
  toggleValue,
  validateApplicationForm,
  type FieldErrors,
} from "../../../shared/registration/validation";

type SavedDraft =
  | {
      draft?: Partial<ApplicationFormData>;
      status?: string;
      savedResume?: SavedResumeDraft | null;
      resumeMissing?: boolean;
    }
  | null
  | undefined;

function ApplicationFormContent({
  onSubmitted,
  savedDraft,
  saveDraft,
  hasConvexClient,
  initialForm = INITIAL_FORM,
  initialSavedResume = null,
  draftHydrated = true,
  getUploadAuthToken,
}: {
  onSubmitted: () => void;
  savedDraft: SavedDraft;
  saveDraft:
    | ((args: {
        patch: ReturnType<typeof formToDraftPatch>;
      }) => Promise<unknown>)
    | null;
  hasConvexClient: boolean;
  initialForm?: ApplicationFormData;
  initialSavedResume?: SavedResumeDraft | null;
  draftHydrated?: boolean;
  getUploadAuthToken?: () => Promise<string | null | undefined>;
}) {
  const [form, setForm] = useState<ApplicationFormData>(initialForm);
  const [savedResume, setSavedResume] = useState<SavedResumeDraft | null>(
    initialSavedResume,
  );
  const [resumeStatus, setResumeStatus] = useState<
    "idle" | "uploading" | "removing"
  >("idle");
  const [errors, setErrors] = useState<FieldErrors>(() =>
    savedDraft?.resumeMissing ? { resume: RESUME_MISSING_MESSAGE } : {},
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { isAuthenticated } = useSessionAuth();
  const routing = useApplicantRouting();
  const [resumeUpload, setResumeUpload] = useState<{
    fileKey: string;
    session: ResumeUploadSession;
  } | null>(null);
  const resumeUploadRef = useRef(resumeUpload);
  const formRef = useRef(form);
  const savedDraftStatus = savedDraft?.status;
  const canSaveDraft = Boolean(saveDraft && routing.isAuthenticated);

  const saveDraftWithStatus = useCallback(async () => {
    if (!saveDraft || !routing.isAuthenticated) return;
    try {
      await saveDraft({ patch: formToDraftPatch(form) });
      setDraftError(null);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Draft save failed:", error);
      }
      setDraftError(DRAFT_SAVE_ERROR_MESSAGE);
      throw error;
    }
  }, [form, routing.isAuthenticated, saveDraft]);

  useEffect(() => {
    resumeUploadRef.current = resumeUpload;
  }, [resumeUpload]);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  useEffect(() => {
    if (
      !hasConvexClient ||
      !saveDraft ||
      !routing.isAuthenticated ||
      !draftHydrated
    ) {
      return;
    }
    if (savedDraftStatus && savedDraftStatus !== "draft") return;

    const timer = window.setTimeout(() => {
      void saveDraftWithStatus().catch(() => undefined);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [
    draftHydrated,
    form,
    hasConvexClient,
    routing.isAuthenticated,
    saveDraft,
    saveDraftWithStatus,
    savedDraftStatus,
  ]);

  const discardUnsavedUpload = useCallback(async () => {
    const pending = resumeUploadRef.current;
    if (!pending) return;
    setResumeUpload(null);
    await discardResumeUpload(pending.session.uploadToken);
  }, []);

  useEffect(() => {
    const cleanupPendingUpload = () => {
      const pending = resumeUploadRef.current;
      if (!pending) return;
      void discardResumeUpload(pending.session.uploadToken);
    };
    window.addEventListener("beforeunload", cleanupPendingUpload);
    return () => {
      window.removeEventListener("beforeunload", cleanupPendingUpload);
      void discardUnsavedUpload();
    };
  }, [discardUnsavedUpload]);

  const handleResumeChange = useCallback(
    async (file: File | null) => {
      const showResumeError = (message: string) => {
        setErrors((prev) => ({ ...prev, resume: message }));
        focusFirstInvalidField({ resume: message });
      };

      if (!file) {
        await discardUnsavedUpload();
        setForm((prev) => ({ ...prev, resume: null }));
        if (!savedResume || !saveDraft || !canSaveDraft) {
          setSavedResume(null);
          return;
        }
        setResumeStatus("removing");
        try {
          await saveDraft({ patch: formToDraftPatch(formRef.current, null) });
          setSavedResume(null);
          setDraftError(null);
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error("Removing saved resume failed:", error);
          }
          showResumeError(RESUME_REMOVE_ERROR_MESSAGE);
        } finally {
          setResumeStatus("idle");
        }
        return;
      }

      setForm((prev) => ({ ...prev, resume: file }));
      setErrors((prev) => {
        if (!prev.resume) return prev;
        const next = { ...prev };
        delete next.resume;
        return next;
      });
      if (!getUploadAuthToken) return;

      setResumeStatus("uploading");
      let uploadedSession: ResumeUploadSession | null = null;
      try {
        await discardUnsavedUpload();
        const authToken = await getUploadAuthToken();
        uploadedSession = await uploadResume(file, authToken);
        const nextSavedResume = {
          storageId: uploadedSession.storageId,
          filename: file.name,
        };

        if (saveDraft && canSaveDraft) {
          try {
            await saveDraft({
              patch: formToDraftPatch(formRef.current, nextSavedResume),
            });
          } catch (error) {
            await discardResumeUpload(uploadedSession.uploadToken);
            uploadedSession = null;
            setForm((prev) => ({ ...prev, resume: null }));
            if (import.meta.env.DEV) {
              console.error("Saving resume to draft failed:", error);
            }
            const mapped = mapConvexErrorToUserMessage(error);
            showResumeError(
              isResumeFieldMessage(mapped)
                ? mapped
                : RESUME_UPLOAD_ERROR_MESSAGE,
            );
            return;
          }
          setDraftError(null);
          await discardResumeUpload(uploadedSession.uploadToken);
          uploadedSession = null;
        } else {
          setResumeUpload({
            fileKey: resumeFileKey(file),
            session: uploadedSession,
          });
        }
        setSavedResume(nextSavedResume);
        setForm((prev) => ({ ...prev, resume: null }));
      } catch (err) {
        if (uploadedSession) {
          await discardResumeUpload(uploadedSession.uploadToken);
        }
        setResumeUpload(null);
        setForm((prev) => ({ ...prev, resume: null }));
        if (!canSaveDraft) {
          setSavedResume(null);
        }
        showResumeError(mapUploadError(err));
      } finally {
        setResumeStatus("idle");
      }
    },
    [
      canSaveDraft,
      discardUnsavedUpload,
      getUploadAuthToken,
      saveDraft,
      savedResume,
    ],
  );

  const updateField = useCallback(
    <K extends keyof ApplicationFormData>(
      key: K,
      value: ApplicationFormData[K],
    ) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        if (!prev[key as FieldName]) return prev;
        const next = { ...prev };
        delete next[key as FieldName];
        return next;
      });
    },
    [],
  );

  const updateCountry = useCallback(
    (country: ApplicationFormData["countryOfResidence"]) => {
      setForm((prev) =>
        normalizeResidenceFormFields({
          ...prev,
          countryOfResidence: country,
          stateOfResidence: requiresUsState(country)
            ? prev.stateOfResidence
            : "",
        }),
      );
      setErrors((prev) => {
        if (!prev.stateOfResidence && !prev.countryOfResidence) return prev;
        const next = { ...prev };
        delete next.stateOfResidence;
        if (country) delete next.countryOfResidence;
        return next;
      });
    },
    [],
  );

  const stateRequired = requiresUsState(form.countryOfResidence);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!isAuthenticated && !routing.isAuthenticated) {
      setSubmitError(SIGN_IN_REQUIRED_MESSAGE);
      return;
    }

    setSubmitError(null);

    const validation = validateApplicationForm(form);

    if (!validation.success) {
      setErrors(validation.errors);
      focusFirstInvalidField(validation.errors);
      return;
    }

    setErrors({});

    setSubmitting(true);
    try {
      if (hasConvexClient && saveDraft && routing.isAuthenticated) {
        try {
          await saveDraftWithStatus();
        } catch {
          return;
        }
      }
      let session: ResumeUploadSession | null = resumeUpload?.session ?? null;
      if (!session && form.resume) {
        try {
          const authToken = getUploadAuthToken
            ? await getUploadAuthToken()
            : null;
          session = await uploadResume(form.resume, authToken);
          setResumeUpload({ fileKey: resumeFileKey(form.resume), session });
        } catch (err) {
          const message = mapUploadError(err);
          setErrors((prev) => ({ ...prev, resume: message }));
          focusFirstInvalidField({ resume: message });
          return;
        }
      }

      const resumeStorageId = session?.storageId ?? savedResume?.storageId;
      const submissionPayload = resumeStorageId
        ? { ...validation.payload, resumeStorageId }
        : validation.payload;

      await submitRegistration(submissionPayload, session);
      setResumeUpload(null);
      onSubmitted();
    } catch (err) {
      console.error("Registration submission failed", err);
      const message = mapConvexErrorToUserMessage(err);
      if (isResumeFieldMessage(message)) {
        setErrors((prev) => ({ ...prev, resume: message }));
        focusFirstInvalidField({ resume: message });
      } else {
        setSubmitError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
      {routing.verifiedEmail ? (
        <div className="rounded-lg border-2 border-(--sand) bg-white px-4 py-3">
          <p className={legendClass}>Verified email</p>
          <p
            className={`${inputClass} mt-1 border-0 bg-transparent px-0 py-0 text-(--ink)`}
          >
            {routing.verifiedEmail}
          </p>
        </div>
      ) : null}

      <div className="border-b-2 border-(--sand) pb-6">
        <h2 className="font-(family-name:--font-display) text-2xl text-(--ink)">
          Tell us about yourself
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-(--ocean)">
          Fields marked with{" "}
          <span className="font-semibold" aria-hidden="true">
            *
          </span>{" "}
          are required. Your application will be saved when submitted.
        </p>
      </div>

      <section className="space-y-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-(--ocean)">
          <span
            className="inline-block h-1 w-8 bg-(--ocean)"
            aria-hidden="true"
          ></span>
          Personal Information
        </h3>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField
            id="firstName"
            label="First name"
            required
            value={form.firstName}
            onChange={(e) => updateField("firstName", e.target.value)}
            autoComplete="given-name"
            maxLength={FIELD_LIMITS.name}
            error={errors.firstName}
          />
          <TextField
            id="lastName"
            label="Last name"
            required
            value={form.lastName}
            onChange={(e) => updateField("lastName", e.target.value)}
            autoComplete="family-name"
            maxLength={FIELD_LIMITS.name}
            error={errors.lastName}
          />
          <TextField
            id="phone"
            label="Phone number"
            required
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            autoComplete="tel"
            maxLength={FIELD_LIMITS.phone}
            error={errors.phone}
          />
          <TextField
            id="age"
            label="Age"
            required
            type="number"
            inputMode="numeric"
            min={18}
            step={1}
            value={form.age}
            onChange={(e) => updateField("age", e.target.value)}
            autoComplete="off"
            error={errors.age}
          />
          <SearchableSelect
            id="school"
            label="School / university"
            required
            placeholder="Search schools"
            value={form.school}
            options={MLH_SCHOOLS}
            featuredOptions={MLH_TEXAS_SCHOOLS}
            extraOptions={[SCHOOL_OTHER_OPTION]}
            onChange={(value) =>
              updateField("school", value as ApplicationFormData["school"])
            }
            error={errors.school}
          />
          {form.school === SCHOOL_OTHER_OPTION ? (
            <TextField
              id="otherSchool"
              label="Enter your school / university"
              required
              value={form.otherSchool}
              onChange={(e) => updateField("otherSchool", e.target.value)}
              maxLength={FIELD_LIMITS.otherSchool}
              error={errors.otherSchool}
            />
          ) : null}
          <TextField
            id="studentEmail"
            label="Student email (optional)"
            type="email"
            inputMode="email"
            autoComplete="section-student email"
            spellCheck={false}
            autoCapitalize="none"
            value={form.studentEmail}
            onChange={(e) => updateField("studentEmail", e.target.value)}
            maxLength={FIELD_LIMITS.email}
            helperText="If you signed up with a personal email, you can provide your school email here."
            error={errors.studentEmail}
          />
          <SelectField
            id="countryOfResidence"
            label="Country of residence"
            required
            value={form.countryOfResidence}
            options={COUNTRIES_OF_RESIDENCE}
            onChange={(value) =>
              updateCountry(value as ApplicationFormData["countryOfResidence"])
            }
            error={errors.countryOfResidence}
          />
          <SelectField
            id="stateOfResidence"
            label="State of residence"
            required={stateRequired}
            disabled={!stateRequired}
            value={form.stateOfResidence}
            options={US_STATE_OPTIONS}
            onChange={(value) =>
              updateField(
                "stateOfResidence",
                value as ApplicationFormData["stateOfResidence"],
              )
            }
            error={errors.stateOfResidence}
          />
          <fieldset
            className={`sm:col-span-2 ${checkboxFieldsetClass} ${fieldsetErrorClass(!!errors.internationalStudent)}`}
            aria-describedby={
              errors.internationalStudent
                ? "internationalStudent-error"
                : undefined
            }
          >
            <legend className={fieldsetLegendClass}>
              Are you an international student?
              <span aria-hidden="true"> *</span>
            </legend>
            <div className={inlineRadioGroupClass}>
              <CustomRadio
                id="internationalStudent-yes"
                name="internationalStudent"
                label="Yes"
                checked={form.internationalStudent === true}
                onChange={() => updateField("internationalStudent", true)}
              />
              <CustomRadio
                id="internationalStudent-no"
                name="internationalStudent"
                label="No"
                checked={form.internationalStudent === false}
                onChange={() => updateField("internationalStudent", false)}
              />
            </div>
            <FieldError
              id="internationalStudent-error"
              message={errors.internationalStudent}
            />
          </fieldset>
          <SelectField
            id="levelOfStudy"
            label="Level of study"
            required
            value={form.levelOfStudy}
            options={LEVELS_OF_STUDY}
            onChange={(value) =>
              updateField(
                "levelOfStudy",
                value as ApplicationFormData["levelOfStudy"],
              )
            }
            error={errors.levelOfStudy}
          />
          <SelectField
            id="major"
            label="Major / field of study"
            required
            value={form.major}
            options={MAJORS}
            onChange={(value) =>
              updateField("major", value as ApplicationFormData["major"])
            }
            error={errors.major}
          />
          {form.major === MAJOR_OTHER_OPTION ? (
            <TextField
              id="otherMajor"
              label="Describe your major / field of study"
              required
              value={form.otherMajor}
              onChange={(e) => updateField("otherMajor", e.target.value)}
              maxLength={FIELD_LIMITS.otherMajor}
              error={errors.otherMajor}
            />
          ) : null}
          <TextField
            id="graduationYear"
            label="Expected graduation year"
            required
            type="number"
            inputMode="numeric"
            min={MIN_GRADUATION_YEAR}
            max={MAX_GRADUATION_YEAR}
            step={1}
            value={form.graduationYear}
            onChange={(e) => updateField("graduationYear", e.target.value)}
            autoComplete="off"
            error={errors.graduationYear}
          />
        </div>
      </section>

      <section className="space-y-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-(--ocean)">
          <span
            className="inline-block h-1 w-8 bg-(--ocean)"
            aria-hidden="true"
          ></span>
          Demographics
        </h3>

        <SelectField
          id="gender"
          label="Gender"
          required
          value={form.gender}
          options={GENDERS}
          onChange={(value) =>
            updateField("gender", value as ApplicationFormData["gender"])
          }
          error={errors.gender}
        />

        <fieldset
          className={`${checkboxFieldsetClass} ${fieldsetErrorClass(!!errors.otherRaceEthnicity)}`}
        >
          <legend className={fieldsetLegendClass}>
            Race / ethnicity (select all that apply)
          </legend>
          <div className={checkboxGridClass}>
            {RACE_ETHNICITY_OPTIONS.map((option) => (
              <CustomCheckbox
                key={option}
                id={`race-${option.replace(/\s+/g, "-").toLowerCase()}`}
                label={option}
                checked={form.raceEthnicity.includes(option)}
                onChange={() =>
                  updateField(
                    "raceEthnicity",
                    toggleValue(form.raceEthnicity, option),
                  )
                }
              />
            ))}
          </div>
          {form.raceEthnicity.includes("Other (Please Specify)") ? (
            <>
              <input
                id="otherRaceEthnicity"
                value={form.otherRaceEthnicity}
                onChange={(e) =>
                  updateField("otherRaceEthnicity", e.target.value)
                }
                placeholder="Please specify your race or ethnicity"
                aria-invalid={!!errors.otherRaceEthnicity}
                aria-describedby={
                  errors.otherRaceEthnicity
                    ? "otherRaceEthnicity-error"
                    : undefined
                }
                maxLength={FIELD_LIMITS.otherRaceEthnicity}
                className={fieldClass(errors.otherRaceEthnicity)}
              />
              <FieldError
                id="otherRaceEthnicity-error"
                message={errors.otherRaceEthnicity}
              />
            </>
          ) : null}
        </fieldset>
      </section>

      <section className="space-y-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-(--ocean)">
          <span
            className="inline-block h-1 w-8 bg-(--ocean)"
            aria-hidden="true"
          ></span>
          Event Preferences
        </h3>

        <fieldset
          className={`${checkboxFieldsetClass} ${fieldsetErrorClass(
            !!errors.allergyDetails ||
              !!errors.otherDietaryRestrictions ||
              !!errors.foodAllergyWaiverAgreed,
          )}`}
        >
          <legend className={fieldsetLegendClass}>
            Dietary restrictions (select all that apply)
          </legend>
          <div className={checkboxGridClass}>
            {DIETARY_OPTIONS.map((option) => (
              <CustomCheckbox
                key={option}
                id={`dietary-${option.replace(/\s+/g, "-").toLowerCase()}`}
                label={option}
                checked={form.dietaryRestrictions.includes(option)}
                onChange={() =>
                  updateField(
                    "dietaryRestrictions",
                    toggleValue(form.dietaryRestrictions, option),
                  )
                }
              />
            ))}
          </div>
          {form.dietaryRestrictions.includes("Allergies") ? (
            <>
              <input
                id="allergyDetails"
                value={form.allergyDetails}
                onChange={(e) => updateField("allergyDetails", e.target.value)}
                placeholder="Please describe your food allergies"
                aria-invalid={!!errors.allergyDetails}
                aria-describedby={
                  errors.allergyDetails ? "allergyDetails-error" : undefined
                }
                maxLength={FIELD_LIMITS.allergyDetails}
                className={fieldClass(errors.allergyDetails)}
              />
              <FieldError
                id="allergyDetails-error"
                message={errors.allergyDetails}
              />
            </>
          ) : null}
          <TextField
            id="otherDietaryRestrictions"
            label="Other dietary restrictions (optional)"
            helperText="Please describe any dietary restrictions not listed above."
            value={form.otherDietaryRestrictions}
            onChange={(e) =>
              updateField("otherDietaryRestrictions", e.target.value)
            }
            maxLength={FIELD_LIMITS.otherDietaryRestrictions}
            error={errors.otherDietaryRestrictions}
          />
          <div className="flex flex-col gap-1">
            <CustomCheckbox
              id="foodAllergyWaiverAgreed"
              label={FOOD_ALLERGY_WAIVER_TEXT}
              required
              checked={form.foodAllergyWaiverAgreed}
              onChange={(e) =>
                updateField("foodAllergyWaiverAgreed", e.target.checked)
              }
              aria-invalid={!!errors.foodAllergyWaiverAgreed}
              aria-describedby={
                errors.foodAllergyWaiverAgreed
                  ? "foodAllergyWaiverAgreed-error"
                  : undefined
              }
            />
            <FieldError
              id="foodAllergyWaiverAgreed-error"
              message={errors.foodAllergyWaiverAgreed}
            />
          </div>
        </fieldset>

        <SelectField
          id="tshirtSize"
          label="T-shirt size"
          required
          value={form.tshirtSize}
          options={TSHIRT_SIZES}
          onChange={(value) =>
            updateField(
              "tshirtSize",
              value as ApplicationFormData["tshirtSize"],
            )
          }
          error={errors.tshirtSize}
        />
      </section>

      <section className="space-y-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-(--ocean)">
          <span
            className="inline-block h-1 w-8 bg-(--ocean)"
            aria-hidden="true"
          ></span>
          Application Questions
        </h3>

        <div className="space-y-5">
          <TextField
            id="hackathonsAttended"
            label="How many hackathons have you attended"
            required
            type="number"
            inputMode="numeric"
            min={MIN_HACKATHONS_ATTENDED}
            max={MAX_HACKATHONS_ATTENDED}
            step={1}
            value={form.hackathonsAttended}
            onChange={(e) => updateField("hackathonsAttended", e.target.value)}
            autoComplete="off"
            error={errors.hackathonsAttended}
          />
          <SelectField
            id="experienceLevel"
            label="Experience level"
            required
            value={form.experienceLevel}
            options={EXPERIENCE_LEVELS}
            onChange={(value) =>
              updateField(
                "experienceLevel",
                value as ApplicationFormData["experienceLevel"],
              )
            }
            error={errors.experienceLevel}
          />
          <TextAreaField
            id="builtOrWantToBuild"
            label={APPLICATION_QUESTIONS.builtOrWantToBuild}
            required
            rows={4}
            value={form.builtOrWantToBuild}
            onChange={(e) => updateField("builtOrWantToBuild", e.target.value)}
            maxLength={FIELD_LIMITS.builtOrWantToBuild}
            helperText={`Up to ${FIELD_LIMITS.builtOrWantToBuild.toLocaleString()} characters.`}
            error={errors.builtOrWantToBuild}
          />
          <TextAreaField
            id="shortDeadlineLearning"
            label={APPLICATION_QUESTIONS.shortDeadlineLearning}
            required
            rows={4}
            value={form.shortDeadlineLearning}
            onChange={(e) =>
              updateField("shortDeadlineLearning", e.target.value)
            }
            maxLength={FIELD_LIMITS.shortDeadlineLearning}
            helperText={`Up to ${FIELD_LIMITS.shortDeadlineLearning.toLocaleString()} characters.`}
            error={errors.shortDeadlineLearning}
          />
        </div>
      </section>

      <section className="space-y-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-(--ocean)">
          <span
            className="inline-block h-1 w-8 bg-(--ocean)"
            aria-hidden="true"
          ></span>
          Additional Information
        </h3>

        <div className="space-y-5">
          <SelectField
            id="hearAbout"
            label="How did you hear about HackUTA?"
            required
            value={form.hearAbout}
            options={HEAR_ABOUT_OPTIONS}
            onChange={(value) =>
              updateField(
                "hearAbout",
                value as ApplicationFormData["hearAbout"],
              )
            }
            error={errors.hearAbout}
          />
          {form.hearAbout === HEAR_ABOUT_OTHER_OPTION ? (
            <TextField
              id="otherHearAbout"
              label="Tell us how you heard about HackUTA"
              required
              value={form.otherHearAbout}
              onChange={(e) => updateField("otherHearAbout", e.target.value)}
              maxLength={FIELD_LIMITS.otherHearAbout}
              error={errors.otherHearAbout}
            />
          ) : null}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ResumeUpload
                file={form.resume}
                savedFilename={savedResume?.filename ?? null}
                uploading={resumeStatus === "uploading"}
                error={errors.resume}
                disabled={submitting || resumeStatus === "removing"}
                onChange={(file) => {
                  void handleResumeChange(file);
                }}
                onError={(error) => {
                  setErrors((prev) => {
                    const next = { ...prev };
                    if (error) next.resume = error;
                    else delete next.resume;
                    return next;
                  });
                }}
              />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1">
              <CustomCheckbox
                id="sponsorSharingConsent"
                label={SPONSOR_SHARING_CONSENT_TEXT}
                checked={form.sponsorSharingConsent}
                onChange={(e) =>
                  updateField("sponsorSharingConsent", e.target.checked)
                }
              />
            </div>
            <TextField
              id="linkedin"
              label="LinkedIn (optional)"
              type="text"
              value={form.linkedin}
              onChange={(e) => updateField("linkedin", e.target.value)}
              placeholder="linkedin.com/in/yourname"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={FIELD_LIMITS.url}
              error={errors.linkedin}
            />
            <TextField
              id="github"
              label="GitHub (optional)"
              type="text"
              value={form.github}
              onChange={(e) => updateField("github", e.target.value)}
              placeholder="github.com/yourname"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={FIELD_LIMITS.url}
              error={errors.github}
            />
            <TextField
              id="portfolio"
              label="Portfolio (optional)"
              type="text"
              value={form.portfolio}
              onChange={(e) => updateField("portfolio", e.target.value)}
              placeholder="yoursite.com"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={FIELD_LIMITS.url}
              error={errors.portfolio}
            />
            <TextField
              id="devpost"
              label="Devpost (optional)"
              type="text"
              value={form.devpost}
              onChange={(e) => updateField("devpost", e.target.value)}
              placeholder="devpost.com"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={FIELD_LIMITS.url}
              error={errors.devpost}
            />
          </div>

          <label className={labelClass}>
            <span className={legendClass}>
              Accessibility needs or accommodations (optional)
            </span>
            <textarea
              value={form.accessibilityNeeds}
              onChange={(e) =>
                updateField("accessibilityNeeds", e.target.value)
              }
              rows={3}
              maxLength={FIELD_LIMITS.accessibilityNeeds}
              className={inputClass}
            />
          </label>
        </div>
      </section>

      <section className="space-y-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-(--ocean)">
          <span
            className="inline-block h-1 w-8 bg-(--ocean)"
            aria-hidden="true"
          ></span>
          Emergency Contact
        </h3>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextField
            id="emergencyContactName"
            label="Emergency contact name"
            required
            value={form.emergencyContactName}
            onChange={(e) =>
              updateField("emergencyContactName", e.target.value)
            }
            maxLength={FIELD_LIMITS.name}
            error={errors.emergencyContactName}
          />
          <TextField
            id="emergencyContactPhone"
            label="Emergency contact phone"
            required
            type="tel"
            inputMode="tel"
            value={form.emergencyContactPhone}
            onChange={(e) =>
              updateField("emergencyContactPhone", e.target.value)
            }
            maxLength={FIELD_LIMITS.phone}
            error={errors.emergencyContactPhone}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-base font-semibold text-(--ocean)">
          <span
            className="inline-block h-1 w-8 bg-(--ocean)"
            aria-hidden="true"
          ></span>
          Agreements
        </h3>

        <div
          className={`flex flex-col gap-4 rounded-xl border-2 bg-white p-5 text-sm ${
            errors.codeOfConductAgreed || errors.mlhDataSharingConsent
              ? "border-red-400 bg-red-50"
              : "border-(--sand)"
          }`}
        >
          <div className="flex flex-col gap-1">
            <CustomCheckbox
              id="codeOfConductAgreed"
              label={
                <>
                  I have read and agree to the{" "}
                  <a
                    href={MLH_CODE_OF_CONDUCT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 text-(--ocean) hover:text-(--ink) transition-colors font-semibold"
                  >
                    MLH Code of Conduct
                  </a>
                  .
                </>
              }
              required
              checked={form.codeOfConductAgreed}
              onChange={(e) =>
                updateField("codeOfConductAgreed", e.target.checked)
              }
              aria-invalid={!!errors.codeOfConductAgreed}
              aria-describedby={
                errors.codeOfConductAgreed
                  ? "codeOfConductAgreed-error"
                  : undefined
              }
            />
            <FieldError
              id="codeOfConductAgreed-error"
              message={errors.codeOfConductAgreed}
            />
          </div>
          <div className="flex flex-col gap-1">
            <CustomCheckbox
              id="mlhDataSharingConsent"
              label={
                <>
                  I authorize HackUTA to share my registration information with
                  Major League Hacking for event administration, ranking, and
                  MLH administration in-line with the{" "}
                  <a
                    href={MLH_PRIVACY_POLICY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 text-(--ocean) hover:text-(--ink) transition-colors font-semibold"
                  >
                    MLH Privacy Policy
                  </a>
                  .
                </>
              }
              required
              checked={form.mlhDataSharingConsent}
              onChange={(e) =>
                updateField("mlhDataSharingConsent", e.target.checked)
              }
              aria-invalid={!!errors.mlhDataSharingConsent}
              aria-describedby={
                errors.mlhDataSharingConsent
                  ? "mlhDataSharingConsent-error"
                  : undefined
              }
            />
            <FieldError
              id="mlhDataSharingConsent-error"
              message={errors.mlhDataSharingConsent}
            />
          </div>
          <CustomCheckbox
            id="mlhCommunicationsConsent"
            label="I authorize MLH to send me occasional emails about relevant events, career opportunities, and community announcements (optional)."
            checked={form.mlhCommunicationsConsent}
            onChange={(e) =>
              updateField("mlhCommunicationsConsent", e.target.checked)
            }
          />
        </div>
      </section>

      {Object.keys(errors).length > 0 && (
        <div
          role="alert"
          className="rounded-lg border-2 border-red-400 bg-red-50 p-4 text-sm font-medium text-red-700"
        >
          ⚠ One or more of your answers is invalid. Please review the fields
          above.
        </div>
      )}

      {submitError && (
        <div
          role="alert"
          className="rounded-lg border-2 border-red-400 bg-red-50 p-4 text-sm font-medium text-red-700"
        >
          {submitError}
        </div>
      )}

      {draftError && (
        <div
          role="status"
          className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 text-sm font-medium text-amber-800"
        >
          <span>{draftError}</span>{" "}
          <button
            type="button"
            className="font-semibold underline underline-offset-2"
            onClick={() => void saveDraftWithStatus().catch(() => undefined)}
          >
            Try saving again
          </button>
        </div>
      )}

      <div className="flex justify-center pt-2">
        <OdysseyButton
          type="submit"
          disabled={submitting || resumeStatus !== "idle"}
        >
          {submitting ? "Submitting your application…" : "Submit application"}
        </OdysseyButton>
      </div>
    </form>
  );
}

function ApplicationFormWithUploadAuth(
  props: Omit<
    Parameters<typeof ApplicationFormContent>[0],
    "getUploadAuthToken"
  >,
) {
  const { fetchAccessToken } = useConvexAuth();
  return (
    <ApplicationFormContent
      {...props}
      getUploadAuthToken={() => fetchAccessToken({ forceRefreshToken: false })}
    />
  );
}

function ApplicationFormWithConvexDraft({
  onSubmitted,
}: {
  onSubmitted: () => void;
}) {
  const client = getConvexClient();
  const routing = useApplicantRouting();
  const savedDraft = useQuery(
    getMyApplicationDraftRef,
    client && routing.isAuthenticated ? {} : "skip",
  );
  const saveDraft = useMutation(saveApplicationDraftRef);
  const isDraftLoading = savedDraft === undefined;
  const initialForm =
    !isDraftLoading && savedDraft?.draft
      ? normalizeResidenceFormFields({
          ...INITIAL_FORM,
          ...savedDraft.draft,
        })
      : INITIAL_FORM;
  const initialSavedResume =
    !isDraftLoading && savedDraft?.savedResume ? savedDraft.savedResume : null;

  if (isDraftLoading) {
    return (
      <main
        className="flex min-h-[12rem] items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-(--ocean)">
          Loading your saved application…
        </p>
      </main>
    );
  }

  return (
    <ApplicationFormWithUploadAuth
      onSubmitted={onSubmitted}
      savedDraft={savedDraft ?? null}
      saveDraft={saveDraft}
      hasConvexClient={Boolean(client)}
      initialForm={initialForm}
      initialSavedResume={initialSavedResume}
      draftHydrated
    />
  );
}

export function ApplicationForm({ onSubmitted }: { onSubmitted: () => void }) {
  if (isMockApiEnabled()) {
    return (
      <ApplicationFormContent
        onSubmitted={onSubmitted}
        savedDraft={null}
        saveDraft={null}
        hasConvexClient={false}
        initialSavedResume={null}
        getUploadAuthToken={async () => "mock-auth-token"}
      />
    );
  }

  return <ApplicationFormWithConvexDraft onSubmitted={onSubmitted} />;
}
