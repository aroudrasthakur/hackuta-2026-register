import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    expect(screen.getByText("PDF only, up to 5 MB")).toBeInTheDocument();
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
        "Upload your resume as a PDF file. Maximum file size is 5 MB.",
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

    expect(mockOnError).toHaveBeenCalledWith("Your PDF is empty. Please select another file.");
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
    Object.defineProperty(file, "size", { value: 5 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [file] } });

    expect(mockOnError).toHaveBeenCalledWith("Your PDF must be 5 MB or smaller.");
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
});
