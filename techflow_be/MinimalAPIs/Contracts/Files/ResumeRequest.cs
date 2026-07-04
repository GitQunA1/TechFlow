namespace MinimalAPIs.Contracts.Files;

public record DepartmentNoteDto(int DepartmentId, string Note, bool IsAffected);
public record ResumeRequest(List<DepartmentNoteDto> DepartmentNotes);

/// <summary>
/// JSON body cho API POST /api/files/{id}/resume-with-path
/// Thay thế multipart/form-data cũ (resume-with-file).
/// </summary>
public record ResumeWithPathRequest(
    string FileName,
    List<DepartmentNoteDto> DepartmentNotes);
