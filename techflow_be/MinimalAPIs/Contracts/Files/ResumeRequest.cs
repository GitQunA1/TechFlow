namespace MinimalAPIs.Contracts.Files;

public record DepartmentNoteDto(int DepartmentId, string Note, bool IsAffected);
public record ResumeRequest(List<DepartmentNoteDto> DepartmentNotes);
