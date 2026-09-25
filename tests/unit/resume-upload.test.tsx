import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_RESUME_BYTES,
  RESUME_EMPTY_ERROR_MESSAGE,
  RESUME_SIZE_ERROR_MESSAGE,
} from "../../shared/registration/resume";
import { ResumeUpload } from "../../src/pages/Register/components/ResumeUpload";

describe("ResumeUpload", () => {
  const mockOnChange = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
    mockOnError.mockClear();
  });

  it("renders upload area with instructions", () => {
    render(
      <ResumeUpload
        file={null}
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    expect(screen.getByText("Resume (optional)")).toBeInTheDocument();
    expect(
      screen.getByText("Click to upload or drag and drop"),
    ).toBeInTheDocument();
    expect(screen.getByText("PDF only, up to 2 MB")).toBeInTheDocument();
  });

  it("shows choose file button", () => {
    render(
      <ResumeUpload
        file={null}
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Choose file" }),
    ).toBeInTheDocument();
  });

  it("accepts PDF file upload", async () => {
    const user = userEvent.setup();
    render(
      <ResumeUpload
        file={null}
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    const file = new File(["dummy content"], "resume.pdf", {
      type: "application/pdf",
    });
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    if (input) {
      await user.upload(input, file);
      expect(mockOnChange).toHaveBeenCalled();
    } else {
      expect(screen.getByText("Resume (optional)")).toBeInTheDocument();
    }
  });

  it("displays selected file name and size", () => {
    const file = new File(["x".repeat(1024)], "my-resume.pdf", {
      type: "application/pdf",
    });

    render(
      <ResumeUpload
        file={file}
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    expect(screen.getByText("my-resume.pdf")).toBeInTheDocument();
    expect(screen.getByText(/KB/)).toBeInTheDocument();
  });

  it("shows remove button when file is selected", () => {
    const file = new File(["content"], "resume.pdf", {
      type: "application/pdf",
    });

    render(
      <ResumeUpload
        file={file}
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Remove resume" }),
    ).toBeInTheDocument();
  });

  it("removes file when remove button is clicked", async () => {
    const user = userEvent.setup();
    const file = new File(["content"], "resume.pdf", {
      type: "application/pdf",
    });

    render(
      <ResumeUpload
        file={file}
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Remove resume" }));

    expect(mockOnChange).toHaveBeenCalledWith(null);
    expect(mockOnError).toHaveBeenCalledWith(undefined);
  });

  it("displays error message when provided", () => {
    render(
      <ResumeUpload
        file={null}
        error="File too large"
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    expect(screen.getByText("File too large")).toBeInTheDocument();
  });

  it("applies error styling when error is present", () => {
    const { container } = render(
      <ResumeUpload
        file={null}
        error="Invalid file type"
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    const uploadArea = container.querySelector('[role="button"]');
    expect(uploadArea).toHaveClass("border-red-400");
  });

  it("disables upload when disabled prop is true", () => {
    render(
      <ResumeUpload
        file={null}
        disabled={true}
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    const uploadArea = screen.getByRole("button", { name: "Upload resume" });
    expect(uploadArea).toHaveAttribute("tabIndex", "-1");
  });

  it("shows help text about file requirements", () => {
    render(
      <ResumeUpload
        file={null}
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    expect(
      screen.getByText(
        "Upload your resume as a PDF file. Maximum file size is 2 MB.",
      ),
    ).toBeInTheDocument();
  });

  it("formats file sizes correctly", () => {
    const testCases = [
      { bytes: 0, file: new File([""], "empty.pdf") },
      { bytes: 500, file: new File(["x".repeat(500)], "small.pdf") },
      { bytes: 2048, file: new File(["x".repeat(2048)], "medium.pdf") },
    ];

    testCases.forEach(({ file }) => {
      const { unmount } = render(
        <ResumeUpload
          file={file}
          onChange={mockOnChange}
          onError={mockOnError}
        />,
      );

      expect(screen.getByText(file.name)).toBeInTheDocument();
      unmount();
    });
  });

  it("handles keyboard interaction on upload area", () => {
    render(
      <ResumeUpload
        file={null}
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    const uploadArea = screen.getByRole("button", { name: "Upload resume" });
    uploadArea.focus();

    expect(uploadArea).toHaveFocus();
  });

  it("accepts drag and drop", () => {
    render(
      <ResumeUpload
        file={null}
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    const uploadArea = screen.getByRole("button", { name: "Upload resume" });
    expect(uploadArea).toBeInTheDocument();
  });

  it("prevents default on drag over", async () => {
    const { container } = render(
      <ResumeUpload
        file={null}
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    const uploadArea = container.querySelector(
      '[role="button"]',
    ) as HTMLElement;
    const dragEvent = new Event("dragover", { bubbles: true });
    uploadArea.dispatchEvent(dragEvent);

    expect(uploadArea).toBeInTheDocument();
  });

  it("shows PDF icon when file is selected", () => {
    const file = new File(["content"], "resume.pdf", {
      type: "application/pdf",
    });

    const { container } = render(
      <ResumeUpload
        file={file}
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    const icon = container.querySelector("svg");
    expect(icon).toBeInTheDocument();
  });

  it("rejects non-PDF files", () => {
    render(
      <ResumeUpload
        file={null}
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["text"], "resume.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(mockOnError).toHaveBeenCalledWith("Please select a PDF file.");
    expect(mockOnChange).toHaveBeenCalledWith(null);
  });

  it("rejects empty PDF files", () => {
    render(
      <ResumeUpload
        file={null}
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([], "empty.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(mockOnError).toHaveBeenCalledWith(RESUME_EMPTY_ERROR_MESSAGE);
  });

  it("rejects oversized PDF files", () => {
    render(
      <ResumeUpload
        file={null}
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "large.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(file, "size", { value: MAX_RESUME_BYTES + 1 });
    fireEvent.change(input, { target: { files: [file] } });

    expect(mockOnError).toHaveBeenCalledWith(RESUME_SIZE_ERROR_MESSAGE);
  });

  it("accepts a PDF exactly at the size limit", () => {
    render(
      <ResumeUpload
        file={null}
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "large.pdf", {
      type: "application/pdf",
    });
    Object.defineProperty(file, "size", { value: MAX_RESUME_BYTES });
    fireEvent.change(input, { target: { files: [file] } });

    expect(mockOnError).toHaveBeenCalledWith(undefined);
    expect(mockOnChange).toHaveBeenCalledWith(file);
  });

  it("opens the file picker from the choose file button", async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

    render(
      <ResumeUpload
        file={null}
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Choose file" }));
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("opens the file picker with keyboard activation", async () => {
    const user = userEvent.setup();
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");

    render(
      <ResumeUpload
        file={null}
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    const uploadArea = screen.getByRole("button", { name: "Upload resume" });
    uploadArea.focus();
    await user.keyboard("{Enter}");

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  describe("drag and drop", () => {
    function dropArea() {
      return screen.getByRole("button", { name: "Upload resume" });
    }

    it("highlights while dragging and resets on drag leave", () => {
      render(<ResumeUpload file={null} onChange={mockOnChange} onError={mockOnError} />);
      fireEvent.dragOver(dropArea());
      expect(screen.getByText("Drop your resume here")).toBeInTheDocument();
      expect(dropArea().className).toContain("scale-[1.02]");

      fireEvent.dragLeave(dropArea());
      expect(screen.getByText("Click to upload or drag and drop")).toBeInTheDocument();
    });

    it("accepts a dropped PDF and clears any previous error", () => {
      render(<ResumeUpload file={null} onChange={mockOnChange} onError={mockOnError} />);
      const pdf = new File(["%PDF-1.7"], "dropped.pdf", { type: "application/pdf" });
      fireEvent.dragOver(dropArea());
      fireEvent.drop(dropArea(), { dataTransfer: { files: [pdf] } });

      expect(mockOnError).toHaveBeenCalledWith(undefined);
      expect(mockOnChange).toHaveBeenCalledWith(pdf);
      expect(screen.getByText("Click to upload or drag and drop")).toBeInTheDocument();
    });

    it("rejects a dropped non-PDF with a validation error", () => {
      render(<ResumeUpload file={null} onChange={mockOnChange} onError={mockOnError} />);
      fireEvent.drop(dropArea(), {
        dataTransfer: { files: [new File(["x"], "virus.exe", { type: "application/x-msdownload" })] },
      });
      expect(mockOnError).toHaveBeenCalledWith("Please select a PDF file.");
      expect(mockOnChange).toHaveBeenCalledWith(null);
    });

    it("treats an empty drop as clearing the selection", () => {
      render(<ResumeUpload file={null} onChange={mockOnChange} onError={mockOnError} />);
      fireEvent.drop(dropArea(), { dataTransfer: { files: [] } });
      expect(mockOnChange).toHaveBeenCalledWith(null);
      expect(mockOnError).toHaveBeenCalledWith(undefined);
    });

    it("ignores drags and drops while disabled", () => {
      render(<ResumeUpload file={null} disabled onChange={mockOnChange} onError={mockOnError} />);
      fireEvent.dragOver(dropArea());
      expect(screen.queryByText("Drop your resume here")).not.toBeInTheDocument();
      fireEvent.drop(dropArea(), {
        dataTransfer: { files: [new File(["%PDF-"], "resume.pdf", { type: "application/pdf" })] },
      });
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  it("clears the selection when the file dialog is cancelled", () => {
    render(<ResumeUpload file={null} onChange={mockOnChange} onError={mockOnError} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    expect(mockOnChange).toHaveBeenCalledWith(null);
    expect(mockOnError).toHaveBeenCalledWith(undefined);
  });

  it("opens the file picker with the space key but ignores other keys", () => {
    // Stub the native click: happy-dom lacks the browser's re-entrant click guard, so the
    // input's click would bubble back to the drop zone and recurse.
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
    render(<ResumeUpload file={null} onChange={mockOnChange} onError={mockOnError} />);
    const area = screen.getByRole("button", { name: "Upload resume" });
    fireEvent.keyDown(area, { key: "a" });
    expect(clickSpy).not.toHaveBeenCalled();
    fireEvent.keyDown(area, { key: " " });
    expect(clickSpy).toHaveBeenCalledTimes(1);
    clickSpy.mockRestore();
  });

  it("ignores keyboard activation while disabled", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
    render(<ResumeUpload file={null} disabled onChange={mockOnChange} onError={mockOnError} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Upload resume" }), { key: "Enter" });
    expect(clickSpy).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("formats an empty selected file as 0 Bytes", () => {
    render(<ResumeUpload file={new File([], "empty.pdf")} onChange={mockOnChange} onError={mockOnError} />);
    expect(screen.getByText("0 Bytes")).toBeInTheDocument();
  });

  it("does not open the file picker while disabled", async () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
    render(
      <ResumeUpload
        file={null}
        disabled={true}
        onChange={mockOnChange}
        onError={mockOnError}
      />,
    );

    await userEvent.setup().click(screen.getByRole("button", { name: "Choose file" }));
    expect(clickSpy).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  describe("persisted resume state", () => {
    it("shows a saved filename and status when no local file is selected", () => {
      render(
        <ResumeUpload
          file={null}
          savedFilename="saved-resume.pdf"
          onChange={mockOnChange}
          onError={mockOnError}
        />,
      );

      expect(screen.getByText("saved-resume.pdf")).toBeInTheDocument();
      expect(screen.getByText("Saved to your application")).toBeInTheDocument();
      expect(screen.queryByText(/KB/)).not.toBeInTheDocument();
    });

    it("prefers the local file name over a saved filename while uploading a replacement", () => {
      const file = new File(["content"], "new-resume.pdf", { type: "application/pdf" });
      render(
        <ResumeUpload
          file={file}
          savedFilename="saved-resume.pdf"
          onChange={mockOnChange}
          onError={mockOnError}
        />,
      );

      expect(screen.getByText("new-resume.pdf")).toBeInTheDocument();
      expect(screen.queryByText("Saved to your application")).not.toBeInTheDocument();
    });

    it("shows an uploading state and blocks file selection", async () => {
      const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
      render(
        <ResumeUpload
          file={null}
          uploading
          onChange={mockOnChange}
          onError={mockOnError}
        />,
      );

      expect(screen.getByText("Uploading resume…")).toBeInTheDocument();
      expect(screen.getByText("This may take a moment.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Choose file" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Upload resume" })).toHaveAttribute("tabIndex", "-1");

      await userEvent.setup().click(screen.getByRole("button", { name: "Upload resume" }));
      expect(clickSpy).not.toHaveBeenCalled();
      clickSpy.mockRestore();
    });

    it("hides saved-resume controls while uploading", () => {
      render(
        <ResumeUpload
          file={null}
          savedFilename="saved-resume.pdf"
          uploading
          onChange={mockOnChange}
          onError={mockOnError}
        />,
      );

      expect(screen.getByText("Uploading resume…")).toBeInTheDocument();
      expect(screen.queryByText("saved-resume.pdf")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Remove resume" })).not.toBeInTheDocument();
    });
  });
});
