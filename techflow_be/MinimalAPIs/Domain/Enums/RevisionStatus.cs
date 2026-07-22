namespace MinimalAPIs.Domain.Enums;

public enum RevisionStatus
{
    Pending = 1,     // Leader đã gửi yêu cầu, Staff chưa submit
    Submitted = 2,   // Staff đã upload file mới, chờ Leader duyệt
    Approved = 3     // Leader đã duyệt → Resume file + publish
}
