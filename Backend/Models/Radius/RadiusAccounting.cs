using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

[Table("radacct")]
public class RadiusAccounting
{
    [Key]
    [Column("radacctid")]
    public long RadAcctId { get; set; }

    [Column("acctsessionid")]
    public string? AcctSessionId { get; set; }

    [Column("acctuniqueid")]
    public string? AcctUniqueId { get; set; }

    [Column("username")]
    public string? UserName { get; set; }

    [Column("realm")]
    public string? Realm { get; set; }

    [Column("nasipaddress")]
    public string? NasIpAddress { get; set; }

    [Column("nasportid")]
    public string? NasPortId { get; set; }

    [Column("nasporttype")]
    public string? NasPortType { get; set; }

    [Column("acctstarttime")]
    public DateTime? AcctStartTime { get; set; }

    [Column("acctupdatetime")]
    public DateTime? AcctUpdateTime { get; set; }

    [Column("acctstoptime")]
    public DateTime? AcctStopTime { get; set; }

    [Column("acctinterval")]
    public long? AcctInterval { get; set; }

    [Column("acctsessiontime")]
    public long? AcctSessionTime { get; set; }

    [Column("acctauthentic")]
    public string? AcctAuthentic { get; set; }

    [Column("connectinfo_start")]
    public string? ConnectInfoStart { get; set; }

    [Column("connectinfo_stop")]
    public string? ConnectInfoStop { get; set; }

    [Column("acctinputoctets")]
    public long? AcctInputOctets { get; set; }

    [Column("acctoutputoctets")]
    public long? AcctOutputOctets { get; set; }

    [Column("calledstationid")]
    public string? CalledStationId { get; set; }

    [Column("callingstationid")]
    public string? CallingStationId { get; set; }

    [Column("acctterminatecause")]
    public string? AcctTerminateCause { get; set; }

    [Column("servicetype")]
    public string? ServiceType { get; set; }

    [Column("framedprotocol")]
    public string? FramedProtocol { get; set; }

    [Column("framedipaddress")]
    public string? FramedIpAddress { get; set; }

    [Column("framedipv6address")]
    public string? FramedIpv6Address { get; set; }

    [Column("framedipv6prefix")]
    public string? FramedIpv6Prefix { get; set; }

    [Column("framedinterfaceid")]
    public string? FramedInterfaceId { get; set; }

    [Column("delegatedipv6prefix")]
    public string? DelegatedIpv6Prefix { get; set; }

    [Column("class")]
    public string? Class { get; set; }
}
