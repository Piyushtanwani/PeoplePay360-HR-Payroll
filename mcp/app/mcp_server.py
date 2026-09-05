import logging
from typing import Optional
from mcp.server.fastmcp import FastMCP
from app.backend import backend_client

logger = logging.getLogger("mcp.fastmcp")

# FastMCP application instance
mcp = FastMCP("PeoplePay360")


@mcp.tool()
async def search_employees(query: str = "", department_id: Optional[int] = None) -> str:
    """Search employees by name or department."""
    params = {"q": query, "departmentId": department_id, "status": "ACTIVE"}
    data = await backend_client.get("/api/employees", params=params)
    return str(data)


@mcp.tool()
async def get_employee_summary(employee_id: int) -> str:
    """Get 360 profile summary for an employee."""
    data = await backend_client.get(f"/api/employees/{employee_id}/summary")
    return str(data)


@mcp.tool()
async def get_leave_balances(employee_id: Optional[int] = None) -> str:
    """Get leave balances across annual, sick, and unpaid leave."""
    params = {"employeeId": employee_id} if employee_id else {}
    data = await backend_client.get("/api/timeoff/balances", params=params)
    return str(data)


@mcp.tool()
async def list_attendance_exceptions(period: str = "2026-08") -> str:
    """List attendance anomalies like missing checkouts or late arrivals for a month."""
    data = await backend_client.get("/api/attendance/exceptions", params={"period": period})
    return str(data)


@mcp.tool()
async def list_payruns(state: Optional[str] = None) -> str:
    """List payruns and their processing states."""
    params = {"state": state} if state else {}
    data = await backend_client.get("/api/payruns", params=params)
    return str(data)


@mcp.tool()
async def explain_payslip(payslip_id: int) -> str:
    """Get itemized salary rule breakdown for a payslip."""
    data = await backend_client.get(f"/api/payslips/{payslip_id}")
    return str(data)


@mcp.tool()
async def get_dashboard_kpis(period: str = "2026-08") -> str:
    """Get executive payroll KPIs and analytics."""
    data = await backend_client.get("/api/reports/dashboard", params={"period": period})
    return str(data)
