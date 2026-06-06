-- =============================================================================
-- AURA ERP - Script de Creación Base de Datos
-- SQL Server 2016 Compatible (Standard Edition)
-- Empresa: Sistemas Infotec
-- Versión: 2.0.0 – Tablas en español, sin palabras reservadas SQL
-- =============================================================================
-- INSTRUCCIONES:
--   1. Ejecutar como sa o usuario con permisos CREATE/DROP DATABASE
--   2. El script ELIMINA la BD AuraERP existente y la recrea desde cero
--   3. Compatible SQL Server 2016+ (NO usa características exclusivas 2019+)
-- =============================================================================

USE master;
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- ELIMINAR BASE DE DATOS EXISTENTE
-- ─────────────────────────────────────────────────────────────────────────────
IF EXISTS (SELECT name FROM sys.databases WHERE name = N'AuraERP')
BEGIN
    ALTER DATABASE [AuraERP] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE [AuraERP];
    PRINT 'Base de datos AuraERP eliminada correctamente.';
END
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- CREAR BASE DE DATOS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE DATABASE [AuraERP]
COLLATE SQL_Latin1_General_CP1_CI_AS;
GO

ALTER DATABASE [AuraERP] SET RECOVERY SIMPLE;
ALTER DATABASE [AuraERP] SET READ_COMMITTED_SNAPSHOT ON;
GO

USE [AuraERP];
GO

-- =============================================================================
-- SECCIÓN 1: CONFIGURACIÓN DEL SISTEMA (MULTI-TENANT)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1.1 Empresas – Tenants (empresas que usan AURA)
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[Empresas] (
    [Id]                  UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [Name]                NVARCHAR(200)    NOT NULL,
    [CommercialName]      NVARCHAR(200)    NULL,
    [Nit]                 NVARCHAR(20)     NOT NULL,
    [Logo]                NVARCHAR(500)    NULL,
    [PrimaryColor]        NVARCHAR(7)      NOT NULL DEFAULT '#1E3A5F',
    [SecondaryColor]      NVARCHAR(7)      NOT NULL DEFAULT '#2D5086',
    [Address]             NVARCHAR(300)    NULL,
    [City]                NVARCHAR(100)    NULL,
    [Department]          NVARCHAR(100)    NULL,
    [Email]               NVARCHAR(200)    NOT NULL,
    [Phone]               NVARCHAR(50)     NULL,
    [Website]             NVARCHAR(200)    NULL,
    [RootPassword]        NVARCHAR(200)    NOT NULL,
    [AgentRegPassword]    NVARCHAR(200)    NOT NULL,
    -- SMTP Microsoft 365
    [SmtpHost]            NVARCHAR(200)    NULL DEFAULT 'smtp.office365.com',
    [SmtpPort]            INT              NOT NULL DEFAULT 587,
    [SmtpUser]            NVARCHAR(200)    NULL,
    [SmtpPassword]        NVARCHAR(500)    NULL,
    [SmtpFromName]        NVARCHAR(200)    NULL,
    [SmtpFromEmail]       NVARCHAR(200)    NULL,
    [EmailSignature]      NVARCHAR(MAX)    NULL,
    -- Configuración archivos
    [FilesBasePath]       NVARCHAR(500)    NOT NULL DEFAULT 'D:\AURA\FILES',
    -- Estado
    [IsActive]            BIT              NOT NULL DEFAULT 1,
    [CreatedAt]           DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt]           DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Empresas] PRIMARY KEY CLUSTERED ([Id])
);
GO

CREATE UNIQUE INDEX [UQ_Empresas_Nit]   ON [dbo].[Empresas]([Nit]);
CREATE UNIQUE INDEX [UQ_Empresas_Email] ON [dbo].[Empresas]([Email]);
GO

-- -----------------------------------------------------------------------------
-- 1.2 ConfiguracionSistema – Parámetros globales por empresa
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[ConfiguracionSistema] (
    [Id]          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [CompanyId]   UNIQUEIDENTIFIER NOT NULL,
    [ConfigKey]   NVARCHAR(100)    NOT NULL,
    [ConfigValue] NVARCHAR(MAX)    NULL,
    [Description] NVARCHAR(500)    NULL,
    [UpdatedAt]   DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ConfiguracionSistema] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_ConfigSistema_Empresas] FOREIGN KEY ([CompanyId])
        REFERENCES [dbo].[Empresas]([Id]) ON DELETE CASCADE
);
GO

CREATE UNIQUE INDEX [UQ_ConfigSistema_Empresa_Clave]
    ON [dbo].[ConfiguracionSistema]([CompanyId],[ConfigKey]);
GO

-- =============================================================================
-- SECCIÓN 2: USUARIOS Y AUTENTICACIÓN
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2.1 RolesSistema – Roles del sistema
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[RolesSistema] (
    [Id]          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [CompanyId]   UNIQUEIDENTIFIER NOT NULL,
    [Name]        NVARCHAR(100)    NOT NULL,
    [Slug]        NVARCHAR(50)     NOT NULL,
    -- 'admin','coordinator','implementer_clinical','implementer_financial',
    -- 'implementer_support','support','client'
    [Description] NVARCHAR(300)    NULL,
    [Permissions] NVARCHAR(MAX)    NULL,   -- JSON array de permisos
    [IsSystem]    BIT              NOT NULL DEFAULT 0,
    [IsActive]    BIT              NOT NULL DEFAULT 1,
    [CreatedAt]   DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_RolesSistema] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_RolesSistema_Empresas] FOREIGN KEY ([CompanyId])
        REFERENCES [dbo].[Empresas]([Id]) ON DELETE CASCADE
);
GO

CREATE UNIQUE INDEX [UQ_RolesSistema_Empresa_Slug]
    ON [dbo].[RolesSistema]([CompanyId],[Slug]);
GO

-- -----------------------------------------------------------------------------
-- 2.2 Usuarios – Usuarios del sistema (agentes y clientes)
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[Usuarios] (
    [Id]               UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [CompanyId]        UNIQUEIDENTIFIER NOT NULL,
    [RoleId]           UNIQUEIDENTIFIER NOT NULL,
    [UserType]         NVARCHAR(10)     NOT NULL,   -- 'agent' | 'client'
    [Document]         NVARCHAR(30)     NOT NULL,
    [FirstName]        NVARCHAR(100)    NOT NULL,
    [LastName]         NVARCHAR(100)    NOT NULL,
    [Email]            NVARCHAR(200)    NOT NULL,
    [PasswordHash]     NVARCHAR(300)    NOT NULL,
    [JobTitle]         NVARCHAR(150)    NULL,
    [Phone]            NVARCHAR(30)     NULL,
    -- Agentes: firma digital
    [SignatureFilePath] NVARCHAR(500)   NULL,
    -- Cliente: empresa cliente a la que pertenece
    [ClientId]         UNIQUEIDENTIFIER NULL,
    -- Estado y seguridad
    [IsActive]         BIT              NOT NULL DEFAULT 1,
    [IsEmailVerified]  BIT              NOT NULL DEFAULT 0,
    [LastLoginAt]      DATETIME2(3)     NULL,
    [FailedLoginCount] INT              NOT NULL DEFAULT 0,
    [LockedUntil]      DATETIME2(3)     NULL,
    [RefreshTokenHash] NVARCHAR(300)    NULL,
    [CreatedAt]        DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt]        DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Usuarios] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_Usuarios_Empresas] FOREIGN KEY ([CompanyId])
        REFERENCES [dbo].[Empresas]([Id]),
    CONSTRAINT [FK_Usuarios_RolesSistema] FOREIGN KEY ([RoleId])
        REFERENCES [dbo].[RolesSistema]([Id]),
    CONSTRAINT [CK_Usuarios_TipoUsuario] CHECK ([UserType] IN ('agent','client'))
);
GO

CREATE UNIQUE INDEX [UQ_Usuarios_Email]       ON [dbo].[Usuarios]([Email]);
CREATE        INDEX [IX_Usuarios_CompanyId]   ON [dbo].[Usuarios]([CompanyId]);
CREATE        INDEX [IX_Usuarios_RoleId]      ON [dbo].[Usuarios]([RoleId]);
CREATE        INDEX [IX_Usuarios_ClientId]    ON [dbo].[Usuarios]([ClientId]);
GO

-- =============================================================================
-- SECCIÓN 3: CLIENTES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3.1 Clientes – Empresas clientes
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[Clientes] (
    [Id]               UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [CompanyId]        UNIQUEIDENTIFIER NOT NULL,
    [Nit]              NVARCHAR(20)     NOT NULL,
    [BusinessName]     NVARCHAR(200)    NOT NULL,   -- Razón Social
    [CommercialName]   NVARCHAR(200)    NULL,        -- Nombre Comercial
    [Address]          NVARCHAR(300)    NULL,
    [City]             NVARCHAR(100)    NULL,
    [Department]       NVARCHAR(100)    NULL,
    [Email]            NVARCHAR(200)    NULL,
    [Phone]            NVARCHAR(50)     NULL,
    [EconomicActivity] NVARCHAR(200)    NULL,
    [IsActive]         BIT              NOT NULL DEFAULT 1,
    [CreatedAt]        DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt]        DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    [CreatedById]      UNIQUEIDENTIFIER NULL,
    CONSTRAINT [PK_Clientes] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_Clientes_Empresas] FOREIGN KEY ([CompanyId])
        REFERENCES [dbo].[Empresas]([Id]),
    CONSTRAINT [FK_Clientes_CreadoPor] FOREIGN KEY ([CreatedById])
        REFERENCES [dbo].[Usuarios]([Id])
);
GO

CREATE UNIQUE INDEX [UQ_Clientes_Nit_Empresa]
    ON [dbo].[Clientes]([CompanyId],[Nit]);
CREATE        INDEX [IX_Clientes_CompanyId]
    ON [dbo].[Clientes]([CompanyId]);
GO

-- -----------------------------------------------------------------------------
-- 3.2 PersonalCliente – Funcionarios del cliente
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[PersonalCliente] (
    [Id]                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [ClientId]              UNIQUEIDENTIFIER NOT NULL,
    [Document]              NVARCHAR(30)     NOT NULL,
    [FirstName]             NVARCHAR(100)    NOT NULL,
    [LastName]              NVARCHAR(100)    NOT NULL,
    [JobTitle]              NVARCHAR(150)    NULL,
    [Email]                 NVARCHAR(200)    NULL,
    [Phone]                 NVARCHAR(30)     NULL,
    [Area]                  NVARCHAR(100)    NULL,
    -- Roles especiales
    [IsProjectLeader]       BIT              NOT NULL DEFAULT 0,
    [IsTrainingParticipant] BIT              NOT NULL DEFAULT 0,
    [IsActSigner]           BIT              NOT NULL DEFAULT 0,
    [IsActive]              BIT              NOT NULL DEFAULT 1,
    [CreatedAt]             DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_PersonalCliente] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_PersonalCliente_Clientes] FOREIGN KEY ([ClientId])
        REFERENCES [dbo].[Clientes]([Id]) ON DELETE CASCADE
);
GO

CREATE INDEX [IX_PersonalCliente_ClientId]
    ON [dbo].[PersonalCliente]([ClientId]);
GO

-- =============================================================================
-- SECCIÓN 4: MOTOR DE PLANTILLAS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 4.1 FlujoPlantillas – Flujos de implementación (biblioteca)
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[FlujoPlantillas] (
    [Id]          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [CompanyId]   UNIQUEIDENTIFIER NOT NULL,
    [Name]        NVARCHAR(200)    NOT NULL,
    [Description] NVARCHAR(500)    NULL,
    [Category]    NVARCHAR(100)    NULL,   -- 'Asistencial','Financiero','Apoyo','Completo'
    [Version]     NVARCHAR(20)     NOT NULL DEFAULT '1.0',
    [IsActive]    BIT              NOT NULL DEFAULT 1,
    [IsDefault]   BIT              NOT NULL DEFAULT 0,
    [CreatedById] UNIQUEIDENTIFIER NULL,
    [CreatedAt]   DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt]   DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_FlujoPlantillas] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_FlujoPlantillas_Empresas] FOREIGN KEY ([CompanyId])
        REFERENCES [dbo].[Empresas]([Id])
);
GO

-- -----------------------------------------------------------------------------
-- 4.2 ModulosPlantilla – Módulos dentro de un flujo
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[ModulosPlantilla] (
    [Id]             UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [TemplateFlowId] UNIQUEIDENTIFIER NOT NULL,
    [Name]           NVARCHAR(200)    NOT NULL,
    [Description]    NVARCHAR(500)    NULL,
    [Order]          INT              NOT NULL DEFAULT 0,
    [EstimatedDays]  INT              NOT NULL DEFAULT 0,
    [IsActive]       BIT              NOT NULL DEFAULT 1,
    CONSTRAINT [PK_ModulosPlantilla] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_ModulosPlantilla_FlujoPlantillas] FOREIGN KEY ([TemplateFlowId])
        REFERENCES [dbo].[FlujoPlantillas]([Id]) ON DELETE CASCADE
);
GO

-- -----------------------------------------------------------------------------
-- 4.3 FasesPlantilla – Fases dentro de un módulo
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[FasesPlantilla] (
    [Id]               UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [TemplateModuleId] UNIQUEIDENTIFIER NOT NULL,
    [Name]             NVARCHAR(200)    NOT NULL,
    [Slug]             NVARCHAR(50)     NOT NULL,
    -- 'kickoff','parameterization','training','validation',
    -- 'testing','production','closure','support_handover'
    [Order]            INT              NOT NULL DEFAULT 0,
    [EstimatedDays]    INT              NOT NULL DEFAULT 0,
    [Color]            NVARCHAR(7)      NULL,
    [Icon]             NVARCHAR(100)    NULL,
    CONSTRAINT [PK_FasesPlantilla] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_FasesPlantilla_ModulosPlantilla] FOREIGN KEY ([TemplateModuleId])
        REFERENCES [dbo].[ModulosPlantilla]([Id]) ON DELETE CASCADE
);
GO

-- -----------------------------------------------------------------------------
-- 4.4 ActividadesPlantilla – Actividades dentro de una fase
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[ActividadesPlantilla] (
    [Id]               UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [TemplatePhaseId]  UNIQUEIDENTIFIER NOT NULL,
    [Code]             NVARCHAR(20)     NOT NULL,
    [Name]             NVARCHAR(300)    NOT NULL,
    [Description]      NVARCHAR(MAX)    NULL,
    [Order]            INT              NOT NULL DEFAULT 0,
    [EstimatedHours]   DECIMAL(6,2)     NOT NULL DEFAULT 0,
    [DefaultRole]      NVARCHAR(50)     NULL,
    [Priority]         NVARCHAR(20)     NOT NULL DEFAULT 'media',
    -- 'baja','media','alta','critica'
    CONSTRAINT [PK_ActividadesPlantilla] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_ActividadesPlantilla_FasesPlantilla] FOREIGN KEY ([TemplatePhaseId])
        REFERENCES [dbo].[FasesPlantilla]([Id]) ON DELETE CASCADE
);
GO

-- -----------------------------------------------------------------------------
-- 4.5 SubActividadesPlantilla – Subactividades
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[SubActividadesPlantilla] (
    [Id]                   UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [TemplateActivityId]   UNIQUEIDENTIFIER NOT NULL,
    [Name]                 NVARCHAR(300)    NOT NULL,
    [Description]          NVARCHAR(MAX)    NULL,
    [Order]                INT              NOT NULL DEFAULT 0,
    [EstimatedHours]       DECIMAL(6,2)     NOT NULL DEFAULT 0,
    CONSTRAINT [PK_SubActividadesPlantilla] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_SubActividadesPlantilla_ActividadesPlantilla]
        FOREIGN KEY ([TemplateActivityId])
        REFERENCES [dbo].[ActividadesPlantilla]([Id]) ON DELETE CASCADE
);
GO

-- -----------------------------------------------------------------------------
-- 4.6 RiesgosPlantilla – Catálogo de riesgos sugeridos
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[RiesgosPlantilla] (
    [Id]               UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [CompanyId]        UNIQUEIDENTIFIER NOT NULL,
    [Name]             NVARCHAR(300)    NOT NULL,
    [Description]      NVARCHAR(MAX)    NULL,
    [Category]         NVARCHAR(100)    NULL,
    [Level]            NVARCHAR(20)     NOT NULL DEFAULT 'media',
    -- 'baja','media','alta','critica'
    [Mitigation]       NVARCHAR(MAX)    NULL,
    [IsActive]         BIT              NOT NULL DEFAULT 1,
    [CreatedAt]        DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_RiesgosPlantilla] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_RiesgosPlantilla_Empresas] FOREIGN KEY ([CompanyId])
        REFERENCES [dbo].[Empresas]([Id])
);
GO

-- =============================================================================
-- SECCIÓN 5: ÓRDENES DE SERVICIO
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 5.1 OrdenesServicio – Órdenes de Servicio
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[OrdenesServicio] (
    [Id]                  UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [CompanyId]           UNIQUEIDENTIFIER NOT NULL,
    [ClientId]            UNIQUEIDENTIFIER NOT NULL,
    [OsNumber]            NVARCHAR(50)     NOT NULL,
    [Product]             NVARCHAR(200)    NOT NULL,
    [Scope]               NVARCHAR(MAX)    NULL,
    [DurationDays]        INT              NOT NULL DEFAULT 0,
    [StartDate]           DATE             NOT NULL,
    [EndDate]             DATE             NOT NULL,
    [Observations]        NVARCHAR(MAX)    NULL,
    -- Asignación equipo
    [ClinicalLeaderId]    UNIQUEIDENTIFIER NULL,
    [FinancialLeaderId]   UNIQUEIDENTIFIER NULL,
    -- Estado
    [Status]              NVARCHAR(30)     NOT NULL DEFAULT 'pendiente',
    -- 'pendiente','activa','en_progreso','en_riesgo','pausada','cerrada','entregada'
    [CreatedById]         UNIQUEIDENTIFIER NOT NULL,
    [CreatedAt]           DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt]           DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_OrdenesServicio] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_OrdenesServicio_Empresas] FOREIGN KEY ([CompanyId])
        REFERENCES [dbo].[Empresas]([Id]),
    CONSTRAINT [FK_OrdenesServicio_Clientes] FOREIGN KEY ([ClientId])
        REFERENCES [dbo].[Clientes]([Id]),
    CONSTRAINT [FK_OrdenesServicio_LiderClinico] FOREIGN KEY ([ClinicalLeaderId])
        REFERENCES [dbo].[Usuarios]([Id]),
    CONSTRAINT [FK_OrdenesServicio_LiderFinanciero] FOREIGN KEY ([FinancialLeaderId])
        REFERENCES [dbo].[Usuarios]([Id]),
    CONSTRAINT [FK_OrdenesServicio_CreadoPor] FOREIGN KEY ([CreatedById])
        REFERENCES [dbo].[Usuarios]([Id])
);
GO

CREATE UNIQUE INDEX [UQ_OrdenesServicio_Numero]
    ON [dbo].[OrdenesServicio]([CompanyId],[OsNumber]);
CREATE        INDEX [IX_OrdenesServicio_ClientId]
    ON [dbo].[OrdenesServicio]([ClientId]);
CREATE        INDEX [IX_OrdenesServicio_Estado]
    ON [dbo].[OrdenesServicio]([Status]);
GO

-- -----------------------------------------------------------------------------
-- 5.2 ImplementadoresOS – Implementadores de apoyo por OS
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[ImplementadoresOS] (
    [ServiceOrderId] UNIQUEIDENTIFIER NOT NULL,
    [UserId]         UNIQUEIDENTIFIER NOT NULL,
    [Role]           NVARCHAR(50)     NOT NULL DEFAULT 'apoyo',
    [AssignedAt]     DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_ImplementadoresOS] PRIMARY KEY CLUSTERED ([ServiceOrderId],[UserId]),
    CONSTRAINT [FK_ImplementadoresOS_OrdenesServicio] FOREIGN KEY ([ServiceOrderId])
        REFERENCES [dbo].[OrdenesServicio]([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_ImplementadoresOS_Usuarios] FOREIGN KEY ([UserId])
        REFERENCES [dbo].[Usuarios]([Id])
);
GO

-- -----------------------------------------------------------------------------
-- 5.3 HistorialOS – Historial de cambios en la OS
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[HistorialOS] (
    [Id]             UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [ServiceOrderId] UNIQUEIDENTIFIER NOT NULL,
    [ChangedById]    UNIQUEIDENTIFIER NOT NULL,
    [FieldName]      NVARCHAR(100)    NOT NULL,
    [OldValue]       NVARCHAR(MAX)    NULL,
    [NewValue]       NVARCHAR(MAX)    NULL,
    [Reason]         NVARCHAR(500)    NULL,
    [CreatedAt]      DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_HistorialOS] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_HistorialOS_OrdenesServicio] FOREIGN KEY ([ServiceOrderId])
        REFERENCES [dbo].[OrdenesServicio]([Id]) ON DELETE CASCADE
);
GO

CREATE INDEX [IX_HistorialOS_OrdenId]
    ON [dbo].[HistorialOS]([ServiceOrderId]);
GO

-- =============================================================================
-- SECCIÓN 6: PROYECTOS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 6.1 Proyectos – Proyecto generado desde una OS
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[Proyectos] (
    [Id]               UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [ServiceOrderId]   UNIQUEIDENTIFIER NOT NULL,
    [TemplateFlowId]   UNIQUEIDENTIFIER NULL,
    [Name]             NVARCHAR(300)    NOT NULL,
    [Description]      NVARCHAR(MAX)    NULL,
    [StartDate]        DATE             NOT NULL,
    [EndDate]          DATE             NOT NULL,
    -- Avance calculado (se actualiza por SP)
    [ProgressPercent]  DECIMAL(5,2)     NOT NULL DEFAULT 0,
    [Status]           NVARCHAR(30)     NOT NULL DEFAULT 'activo',
    -- 'activo','en_riesgo','pausado','cerrado'
    [CreatedAt]        DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt]        DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Proyectos] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_Proyectos_OrdenesServicio] FOREIGN KEY ([ServiceOrderId])
        REFERENCES [dbo].[OrdenesServicio]([Id]),
    CONSTRAINT [FK_Proyectos_FlujoPlantillas] FOREIGN KEY ([TemplateFlowId])
        REFERENCES [dbo].[FlujoPlantillas]([Id])
);
GO

CREATE UNIQUE INDEX [UQ_Proyectos_OrdenServicio]
    ON [dbo].[Proyectos]([ServiceOrderId]);
CREATE        INDEX [IX_Proyectos_Estado]
    ON [dbo].[Proyectos]([Status]);
GO

-- -----------------------------------------------------------------------------
-- 6.2 ModulosProyecto – Módulos del proyecto
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[ModulosProyecto] (
    [Id]              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [ProjectId]       UNIQUEIDENTIFIER NOT NULL,
    [Name]            NVARCHAR(200)    NOT NULL,
    [Order]           INT              NOT NULL DEFAULT 0,
    [ProgressPercent] DECIMAL(5,2)     NOT NULL DEFAULT 0,
    [IsActive]        BIT              NOT NULL DEFAULT 1,
    CONSTRAINT [PK_ModulosProyecto] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_ModulosProyecto_Proyectos] FOREIGN KEY ([ProjectId])
        REFERENCES [dbo].[Proyectos]([Id]) ON DELETE CASCADE
);
GO

CREATE INDEX [IX_ModulosProyecto_ProyectoId]
    ON [dbo].[ModulosProyecto]([ProjectId]);
GO

-- -----------------------------------------------------------------------------
-- 6.3 Fases – Fases del proyecto
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[Fases] (
    [Id]              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [ProjectModuleId] UNIQUEIDENTIFIER NOT NULL,
    [Name]            NVARCHAR(200)    NOT NULL,
    [Slug]            NVARCHAR(50)     NULL,
    [Order]           INT              NOT NULL DEFAULT 0,
    [StartDate]       DATE             NULL,
    [EndDate]         DATE             NULL,
    [ProgressPercent] DECIMAL(5,2)     NOT NULL DEFAULT 0,
    [Status]          NVARCHAR(30)     NOT NULL DEFAULT 'pendiente',
    [Color]           NVARCHAR(7)      NULL,
    [Icon]            NVARCHAR(100)    NULL,
    CONSTRAINT [PK_Fases] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_Fases_ModulosProyecto] FOREIGN KEY ([ProjectModuleId])
        REFERENCES [dbo].[ModulosProyecto]([Id]) ON DELETE CASCADE
);
GO

CREATE INDEX [IX_Fases_ModuloProyectoId]
    ON [dbo].[Fases]([ProjectModuleId]);
GO

-- -----------------------------------------------------------------------------
-- 6.4 Actividades – Actividades del proyecto
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[Actividades] (
    [Id]              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [PhaseId]         UNIQUEIDENTIFIER NOT NULL,
    [Code]            NVARCHAR(30)     NOT NULL,
    [Name]            NVARCHAR(300)    NOT NULL,
    [Description]     NVARCHAR(MAX)    NULL,
    [AssignedToId]    UNIQUEIDENTIFIER NULL,
    [Priority]        NVARCHAR(20)     NOT NULL DEFAULT 'media',
    [Status]          NVARCHAR(30)     NOT NULL DEFAULT 'pendiente',
    -- 'pendiente','en_progreso','completada','vencida','bloqueada'
    [PlannedStartDate]  DATE           NULL,
    [PlannedEndDate]    DATE           NULL,
    [ActualStartDate]   DATE           NULL,
    [ActualEndDate]     DATE           NULL,
    [PlannedHours]    DECIMAL(6,2)     NOT NULL DEFAULT 0,
    [ActualHours]     DECIMAL(6,2)     NOT NULL DEFAULT 0,
    [ProgressPercent] DECIMAL(5,2)     NOT NULL DEFAULT 0,
    [Observations]    NVARCHAR(MAX)    NULL,
    [Order]           INT              NOT NULL DEFAULT 0,
    [CreatedAt]       DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt]       DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Actividades] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_Actividades_Fases] FOREIGN KEY ([PhaseId])
        REFERENCES [dbo].[Fases]([Id]),
    CONSTRAINT [FK_Actividades_AsignadoA] FOREIGN KEY ([AssignedToId])
        REFERENCES [dbo].[Usuarios]([Id])
);
GO

CREATE INDEX [IX_Actividades_FaseId]      ON [dbo].[Actividades]([PhaseId]);
CREATE INDEX [IX_Actividades_AsignadoId]  ON [dbo].[Actividades]([AssignedToId]);
CREATE INDEX [IX_Actividades_Estado]      ON [dbo].[Actividades]([Status]);
GO

-- -----------------------------------------------------------------------------
-- 6.5 DependenciasActividad – Dependencias entre actividades
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[DependenciasActividad] (
    [ActivityId]           UNIQUEIDENTIFIER NOT NULL,
    [DependsOnActivityId]  UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT [PK_DependenciasActividad] PRIMARY KEY CLUSTERED ([ActivityId],[DependsOnActivityId]),
    CONSTRAINT [FK_DepActividad_Actividad] FOREIGN KEY ([ActivityId])
        REFERENCES [dbo].[Actividades]([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_DepActividad_DependeDe] FOREIGN KEY ([DependsOnActivityId])
        REFERENCES [dbo].[Actividades]([Id])
);
GO

-- -----------------------------------------------------------------------------
-- 6.6 SubActividades – Subactividades
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[SubActividades] (
    [Id]              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [ActivityId]      UNIQUEIDENTIFIER NOT NULL,
    [Name]            NVARCHAR(300)    NOT NULL,
    [Description]     NVARCHAR(MAX)    NULL,
    [AssignedToId]    UNIQUEIDENTIFIER NULL,
    [ProgressPercent] DECIMAL(5,2)     NOT NULL DEFAULT 0,
    [PlannedStartDate] DATE            NULL,
    [PlannedEndDate]   DATE            NULL,
    [ActualStartDate]  DATE            NULL,
    [ActualEndDate]    DATE            NULL,
    [Status]          NVARCHAR(30)     NOT NULL DEFAULT 'pendiente',
    [Order]           INT              NOT NULL DEFAULT 0,
    [CreatedAt]       DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt]       DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_SubActividades] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_SubActividades_Actividades] FOREIGN KEY ([ActivityId])
        REFERENCES [dbo].[Actividades]([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_SubActividades_AsignadoA] FOREIGN KEY ([AssignedToId])
        REFERENCES [dbo].[Usuarios]([Id])
);
GO

CREATE INDEX [IX_SubActividades_ActividadId]
    ON [dbo].[SubActividades]([ActivityId]);
GO

-- =============================================================================
-- SECCIÓN 7: VISITAS
-- =============================================================================

CREATE TABLE [dbo].[Visitas] (
    [Id]              UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [ProjectId]       UNIQUEIDENTIFIER NOT NULL,
    [VisitType]       NVARCHAR(20)     NOT NULL DEFAULT 'con_acta',
    -- 'con_acta','sin_acta'
    [VisitDate]       DATE             NOT NULL,
    [StartTime]       TIME(0)          NULL,
    [EndTime]         TIME(0)          NULL,
    [Location]        NVARCHAR(200)    NULL,
    [Objective]       NVARCHAR(MAX)    NULL,
    [ActivitiesDone]  NVARCHAR(MAX)    NULL,
    [Commitments]     NVARCHAR(MAX)    NULL,
    [Observations]    NVARCHAR(MAX)    NULL,
    [Status]          NVARCHAR(30)     NOT NULL DEFAULT 'programada',
    [CreatedById]     UNIQUEIDENTIFIER NOT NULL,
    [CreatedAt]       DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt]       DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Visitas] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_Visitas_Proyectos] FOREIGN KEY ([ProjectId])
        REFERENCES [dbo].[Proyectos]([Id]),
    CONSTRAINT [FK_Visitas_CreadoPor] FOREIGN KEY ([CreatedById])
        REFERENCES [dbo].[Usuarios]([Id])
);
GO

CREATE INDEX [IX_Visitas_ProyectoId]  ON [dbo].[Visitas]([ProjectId]);
CREATE INDEX [IX_Visitas_FechaVisita] ON [dbo].[Visitas]([VisitDate]);
GO

-- Actividades ejecutadas durante una visita
CREATE TABLE [dbo].[ActividadesVisita] (
    [VisitId]      UNIQUEIDENTIFIER NOT NULL,
    [ActivityId]   UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT [PK_ActividadesVisita] PRIMARY KEY CLUSTERED ([VisitId],[ActivityId]),
    CONSTRAINT [FK_ActividadesVisita_Visitas]
        FOREIGN KEY ([VisitId])     REFERENCES [dbo].[Visitas]([Id])     ON DELETE CASCADE,
    CONSTRAINT [FK_ActividadesVisita_Actividades]
        FOREIGN KEY ([ActivityId]) REFERENCES [dbo].[Actividades]([Id])
);
GO

-- =============================================================================
-- SECCIÓN 8: CAPACITACIONES
-- =============================================================================

CREATE TABLE [dbo].[Capacitaciones] (
    [Id]            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [ProjectId]     UNIQUEIDENTIFIER NOT NULL,
    [ModuleId]      UNIQUEIDENTIFIER NULL,
    [Topic]         NVARCHAR(300)    NOT NULL,
    [TrainingDate]  DATE             NOT NULL,
    [DurationHours] DECIMAL(4,2)     NOT NULL DEFAULT 0,
    [Location]      NVARCHAR(200)    NULL,
    [Objective]     NVARCHAR(MAX)    NULL,
    [Observations]  NVARCHAR(MAX)    NULL,
    [TrainerId]     UNIQUEIDENTIFIER NULL,
    [Status]        NVARCHAR(30)     NOT NULL DEFAULT 'programada',
    [CreatedAt]     DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Capacitaciones] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_Capacitaciones_Proyectos]
        FOREIGN KEY ([ProjectId]) REFERENCES [dbo].[Proyectos]([Id]),
    CONSTRAINT [FK_Capacitaciones_ModulosProyecto]
        FOREIGN KEY ([ModuleId])  REFERENCES [dbo].[ModulosProyecto]([Id]),
    CONSTRAINT [FK_Capacitaciones_Capacitador]
        FOREIGN KEY ([TrainerId]) REFERENCES [dbo].[Usuarios]([Id])
);
GO

CREATE INDEX [IX_Capacitaciones_ProyectoId]
    ON [dbo].[Capacitaciones]([ProjectId]);
GO

CREATE TABLE [dbo].[ParticipantesCapacitacion] (
    [Id]            UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [TrainingId]    UNIQUEIDENTIFIER NOT NULL,
    [StaffId]       UNIQUEIDENTIFIER NULL,   -- PersonalCliente (participante del cliente)
    [UserId]        UNIQUEIDENTIFIER NULL,   -- Usuario interno (agente)
    [AttendedAt]    DATETIME2(3)     NULL,
    CONSTRAINT [PK_ParticipantesCapacitacion] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [CK_ParticipantesCapacitacion_UnoDeLosDos]
        CHECK ([StaffId] IS NOT NULL OR [UserId] IS NOT NULL),
    CONSTRAINT [FK_ParticipantesCapacitacion_Capacitaciones]
        FOREIGN KEY ([TrainingId]) REFERENCES [dbo].[Capacitaciones]([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_ParticipantesCapacitacion_PersonalCliente]
        FOREIGN KEY ([StaffId])    REFERENCES [dbo].[PersonalCliente]([Id]),
    CONSTRAINT [FK_ParticipantesCapacitacion_Usuarios]
        FOREIGN KEY ([UserId])     REFERENCES [dbo].[Usuarios]([Id])
);
GO

-- Índices filtrados
CREATE UNIQUE INDEX [UQ_ParticipantesCapacitacion_Training_Staff]
    ON [dbo].[ParticipantesCapacitacion]([TrainingId],[StaffId])
    WHERE [StaffId] IS NOT NULL;

CREATE UNIQUE INDEX [UQ_ParticipantesCapacitacion_Training_User]
    ON [dbo].[ParticipantesCapacitacion]([TrainingId],[UserId])
    WHERE [UserId] IS NOT NULL;
GO

-- =============================================================================
-- SECCIÓN 9: DOCUMENTOS Y FIRMAS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 9.1 Documentos – Actas y documentos generados
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[Documentos] (
    [Id]           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [ProjectId]    UNIQUEIDENTIFIER NOT NULL,
    [DocumentType] NVARCHAR(50)     NOT NULL,
    -- 'acta_inicio','acta_visita','acta_capacitacion','acta_cierre',
    -- 'informe','entrega_soporte'
    [Title]        NVARCHAR(300)    NOT NULL,
    [FilePath]     NVARCHAR(500)    NULL,
    [FileFormat]   NVARCHAR(10)     NULL,   -- 'pdf','docx'
    [Status]       NVARCHAR(30)     NOT NULL DEFAULT 'borrador',
    -- 'borrador','pendiente_firma','firmado','anulado'
    [RelatedId]    UNIQUEIDENTIFIER NULL,
    [GeneratedById] UNIQUEIDENTIFIER NOT NULL,
    [GeneratedAt]  DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    [FinalizedAt]  DATETIME2(3)     NULL,
    CONSTRAINT [PK_Documentos] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_Documentos_Proyectos]
        FOREIGN KEY ([ProjectId])    REFERENCES [dbo].[Proyectos]([Id]),
    CONSTRAINT [FK_Documentos_GeneradoPor]
        FOREIGN KEY ([GeneratedById]) REFERENCES [dbo].[Usuarios]([Id])
);
GO

CREATE INDEX [IX_Documentos_ProyectoId]
    ON [dbo].[Documentos]([ProjectId]);
CREATE INDEX [IX_Documentos_TipoDocumento]
    ON [dbo].[Documentos]([DocumentType]);
GO

-- -----------------------------------------------------------------------------
-- 9.2 Firmas – Firmas digitales de documentos
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[Firmas] (
    [Id]             UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [DocumentId]     UNIQUEIDENTIFIER NOT NULL,
    [SignerType]     NVARCHAR(20)     NOT NULL,   -- 'agent','client_staff'
    [UserId]         UNIQUEIDENTIFIER NULL,
    [StaffId]        UNIQUEIDENTIFIER NULL,
    [SignatureType]  NVARCHAR(20)     NOT NULL DEFAULT 'drawn',   -- 'drawn','image'
    [SignatureFile]  NVARCHAR(500)    NULL,
    [SignedAt]       DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    [IpAddress]      NVARCHAR(50)     NULL,
    [DeviceInfo]     NVARCHAR(300)    NULL,
    CONSTRAINT [PK_Firmas] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_Firmas_Documentos]
        FOREIGN KEY ([DocumentId]) REFERENCES [dbo].[Documentos]([Id])  ON DELETE CASCADE,
    CONSTRAINT [FK_Firmas_Usuarios]
        FOREIGN KEY ([UserId])     REFERENCES [dbo].[Usuarios]([Id]),
    CONSTRAINT [FK_Firmas_PersonalCliente]
        FOREIGN KEY ([StaffId])    REFERENCES [dbo].[PersonalCliente]([Id])
);
GO

-- =============================================================================
-- SECCIÓN 10: EVIDENCIAS
-- =============================================================================

CREATE TABLE [dbo].[Evidencias] (
    [Id]           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [EntityType]   NVARCHAR(50)     NOT NULL,
    -- 'project','module','activity','training','visit'
    [EntityId]     UNIQUEIDENTIFIER NOT NULL,
    [FileName]     NVARCHAR(300)    NOT NULL,
    [FilePath]     NVARCHAR(500)    NOT NULL,
    [FileType]     NVARCHAR(20)     NULL,
    -- 'pdf','docx','xlsx','png','jpg','mp4','mp3'
    [FileSizeKb]   INT              NULL,
    [Description]  NVARCHAR(500)    NULL,
    [UploadedById] UNIQUEIDENTIFIER NOT NULL,
    [UploadedAt]   DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Evidencias] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_Evidencias_SubidoPor]
        FOREIGN KEY ([UploadedById]) REFERENCES [dbo].[Usuarios]([Id])
);
GO

CREATE INDEX [IX_Evidencias_Entidad]
    ON [dbo].[Evidencias]([EntityType],[EntityId]);
GO

-- =============================================================================
-- SECCIÓN 11: RIESGOS
-- =============================================================================

CREATE TABLE [dbo].[Riesgos] (
    [Id]          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [EntityType]  NVARCHAR(30)     NOT NULL,   -- 'project','activity','novelty'
    [EntityId]    UNIQUEIDENTIFIER NOT NULL,
    [Name]        NVARCHAR(300)    NOT NULL,
    [Description] NVARCHAR(MAX)    NULL,
    [Level]       NVARCHAR(20)     NOT NULL DEFAULT 'medio',
    -- 'bajo','medio','alto','critico'
    [Probability] NVARCHAR(20)     NULL,
    [Impact]      NVARCHAR(20)     NULL,
    [Mitigation]  NVARCHAR(MAX)    NULL,
    [Status]      NVARCHAR(30)     NOT NULL DEFAULT 'activo',
    -- 'activo','mitigado','materializado','cerrado'
    [ReportedById] UNIQUEIDENTIFIER NOT NULL,
    [CreatedAt]   DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt]   DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Riesgos] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_Riesgos_ReportadoPor]
        FOREIGN KEY ([ReportedById]) REFERENCES [dbo].[Usuarios]([Id])
);
GO

CREATE INDEX [IX_Riesgos_Entidad] ON [dbo].[Riesgos]([EntityType],[EntityId]);
CREATE INDEX [IX_Riesgos_Nivel]   ON [dbo].[Riesgos]([Level]);
GO

-- =============================================================================
-- SECCIÓN 12: NOVEDADES DEL PROYECTO
-- =============================================================================

CREATE TABLE [dbo].[Novedades] (
    [Id]             UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [ProjectId]      UNIQUEIDENTIFIER NOT NULL,
    [NoveltyType]    NVARCHAR(50)     NOT NULL,
    -- 'cambio_alcance','solicitud_cliente','incidente','infraestructura','riesgo',
    -- 'capacitacion_extra','requerimiento','cambio_responsable','otro'
    [Title]          NVARCHAR(300)    NOT NULL,
    [Description]    NVARCHAR(MAX)    NULL,
    [Impact]         NVARCHAR(MAX)    NULL,
    [AffectsSchedule] BIT             NOT NULL DEFAULT 0,
    [DaysImpact]     INT              NOT NULL DEFAULT 0,
    [Status]         NVARCHAR(30)     NOT NULL DEFAULT 'abierta',
    -- 'abierta','en_gestion','cerrada'
    [ReportedById]   UNIQUEIDENTIFIER NOT NULL,
    [CreatedAt]      DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt]      DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Novedades] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_Novedades_Proyectos]
        FOREIGN KEY ([ProjectId])    REFERENCES [dbo].[Proyectos]([Id]),
    CONSTRAINT [FK_Novedades_ReportadoPor]
        FOREIGN KEY ([ReportedById]) REFERENCES [dbo].[Usuarios]([Id])
);
GO

CREATE INDEX [IX_Novedades_ProyectoId] ON [dbo].[Novedades]([ProjectId]);
CREATE INDEX [IX_Novedades_Estado]     ON [dbo].[Novedades]([Status]);
GO

-- =============================================================================
-- SECCIÓN 13: LECCIONES APRENDIDAS
-- =============================================================================

CREATE TABLE [dbo].[LeccionesAprendidas] (
    [Id]                      UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [ProjectId]               UNIQUEIDENTIFIER NOT NULL,
    [WhatWentWell]            NVARCHAR(MAX)    NULL,
    [WhatWentWrong]           NVARCHAR(MAX)    NULL,
    [ImplementerRecommendations] NVARCHAR(MAX) NULL,
    [ClientRecommendations]   NVARCHAR(MAX)    NULL,
    [AiAnalysis]              NVARCHAR(MAX)    NULL,   -- Análisis generado por IA
    [CreatedById]             UNIQUEIDENTIFIER NOT NULL,
    [CreatedAt]               DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt]               DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_LeccionesAprendidas] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_LeccionesAprendidas_Proyectos]
        FOREIGN KEY ([ProjectId])   REFERENCES [dbo].[Proyectos]([Id]),
    CONSTRAINT [FK_LeccionesAprendidas_CreadoPor]
        FOREIGN KEY ([CreatedById]) REFERENCES [dbo].[Usuarios]([Id])
);
GO

-- =============================================================================
-- SECCIÓN 14: ENTREGA A SOPORTE
-- =============================================================================

CREATE TABLE [dbo].[EntregasSoporte] (
    [Id]                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [ProjectId]             UNIQUEIDENTIFIER NOT NULL,
    [ModulesImplemented]    NVARCHAR(MAX)    NULL,   -- JSON array
    [InfraValidated]        BIT              NOT NULL DEFAULT 0,
    [TrainingCompleted]     BIT              NOT NULL DEFAULT 0,
    [DocumentationDelivered] BIT             NOT NULL DEFAULT 0,
    [ElectronicEmission]    BIT              NOT NULL DEFAULT 0,
    [Observations]          NVARCHAR(MAX)    NULL,
    [HandoverDate]          DATE             NULL,
    [Status]                NVARCHAR(30)     NOT NULL DEFAULT 'pendiente',
    [CreatedById]           UNIQUEIDENTIFIER NOT NULL,
    [CreatedAt]             DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt]             DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_EntregasSoporte] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_EntregasSoporte_Proyectos]
        FOREIGN KEY ([ProjectId])   REFERENCES [dbo].[Proyectos]([Id]),
    CONSTRAINT [FK_EntregasSoporte_CreadoPor]
        FOREIGN KEY ([CreatedById]) REFERENCES [dbo].[Usuarios]([Id])
);
GO

CREATE UNIQUE INDEX [UQ_EntregasSoporte_Proyecto]
    ON [dbo].[EntregasSoporte]([ProjectId]);
GO

-- =============================================================================
-- SECCIÓN 15: INFORMES Y CORREOS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 15.1 InformesProgramados – Informes programados
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[InformesProgramados] (
    [Id]           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [ProjectId]    UNIQUEIDENTIFIER NOT NULL,
    [ReportType]   NVARCHAR(50)     NOT NULL,
    -- 'semanal','quincenal','mensual','personalizado'
    [Frequency]    NVARCHAR(20)     NOT NULL,
    -- 'daily','weekly','biweekly','monthly','custom'
    [CronExpr]     NVARCHAR(50)     NULL,
    [Formats]      NVARCHAR(100)    NOT NULL DEFAULT 'pdf',  -- 'pdf,excel,pptx'
    [Recipients]   NVARCHAR(MAX)    NULL,      -- JSON array emails
    [IsActive]     BIT              NOT NULL DEFAULT 1,
    [LastRunAt]    DATETIME2(3)     NULL,
    [NextRunAt]    DATETIME2(3)     NULL,
    [CreatedById]  UNIQUEIDENTIFIER NOT NULL,
    [CreatedAt]    DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_InformesProgramados] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_InformesProgramados_Proyectos]
        FOREIGN KEY ([ProjectId])   REFERENCES [dbo].[Proyectos]([Id]),
    CONSTRAINT [FK_InformesProgramados_CreadoPor]
        FOREIGN KEY ([CreatedById]) REFERENCES [dbo].[Usuarios]([Id])
);
GO

-- -----------------------------------------------------------------------------
-- 15.2 PlantillasCorreo – Plantillas de correo electrónico
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[PlantillasCorreo] (
    [Id]          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [CompanyId]   UNIQUEIDENTIFIER NOT NULL,
    [Name]        NVARCHAR(200)    NOT NULL,
    [Slug]        NVARCHAR(100)    NOT NULL,
    [Subject]     NVARCHAR(300)    NOT NULL,
    [BodyHtml]    NVARCHAR(MAX)    NOT NULL,
    [Variables]   NVARCHAR(MAX)    NULL,   -- JSON array de variables disponibles
    [IsActive]    BIT              NOT NULL DEFAULT 1,
    [CreatedAt]   DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_PlantillasCorreo] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_PlantillasCorreo_Empresas]
        FOREIGN KEY ([CompanyId]) REFERENCES [dbo].[Empresas]([Id])
);
GO

CREATE UNIQUE INDEX [UQ_PlantillasCorreo_Empresa_Slug]
    ON [dbo].[PlantillasCorreo]([CompanyId],[Slug]);
GO

-- =============================================================================
-- SECCIÓN 16: NOTIFICACIONES Y AUDITORÍA
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 16.1 Notificaciones
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[Notificaciones] (
    [Id]          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
    [UserId]      UNIQUEIDENTIFIER NOT NULL,
    [Type]        NVARCHAR(50)     NOT NULL,
    [Title]       NVARCHAR(300)    NOT NULL,
    [Message]     NVARCHAR(MAX)    NULL,
    [EntityType]  NVARCHAR(50)     NULL,
    [EntityId]    UNIQUEIDENTIFIER NULL,
    [IsRead]      BIT              NOT NULL DEFAULT 0,
    [ReadAt]      DATETIME2(3)     NULL,
    [CreatedAt]   DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Notificaciones] PRIMARY KEY CLUSTERED ([Id]),
    CONSTRAINT [FK_Notificaciones_Usuarios]
        FOREIGN KEY ([UserId]) REFERENCES [dbo].[Usuarios]([Id]) ON DELETE CASCADE
);
GO

CREATE INDEX [IX_Notificaciones_Usuario_Leido]
    ON [dbo].[Notificaciones]([UserId],[IsRead]);
CREATE INDEX [IX_Notificaciones_FechaCreacion]
    ON [dbo].[Notificaciones]([CreatedAt] DESC);
GO

-- -----------------------------------------------------------------------------
-- 16.2 RegistroAuditoria – Auditoría completa
-- -----------------------------------------------------------------------------
CREATE TABLE [dbo].[RegistroAuditoria] (
    [Id]          BIGINT           NOT NULL IDENTITY(1,1),
    [CompanyId]   UNIQUEIDENTIFIER NULL,
    [UserId]      UNIQUEIDENTIFIER NULL,
    [EntityType]  NVARCHAR(100)    NOT NULL,
    [EntityId]    NVARCHAR(100)    NULL,
    [Action]      NVARCHAR(50)     NOT NULL,
    -- 'CREATE','UPDATE','DELETE','LOGIN','LOGOUT','SIGN'
    [OldValues]   NVARCHAR(MAX)    NULL,   -- JSON
    [NewValues]   NVARCHAR(MAX)    NULL,   -- JSON
    [IpAddress]   NVARCHAR(50)     NULL,
    [UserAgent]   NVARCHAR(500)    NULL,
    [CreatedAt]   DATETIME2(3)     NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_RegistroAuditoria] PRIMARY KEY CLUSTERED ([Id])
);
GO

CREATE INDEX [IX_RegistroAuditoria_EntidadTipo_Id]
    ON [dbo].[RegistroAuditoria]([EntityType],[EntityId]);
CREATE INDEX [IX_RegistroAuditoria_UsuarioId]
    ON [dbo].[RegistroAuditoria]([UserId]);
CREATE INDEX [IX_RegistroAuditoria_FechaCreacion]
    ON [dbo].[RegistroAuditoria]([CreatedAt] DESC);
GO

-- FK diferida: Usuarios → Clientes (evita referencia circular en creación)
ALTER TABLE [dbo].[Usuarios] ADD CONSTRAINT [FK_Usuarios_ClientId]
    FOREIGN KEY ([ClientId]) REFERENCES [dbo].[Clientes]([Id]);
GO

-- =============================================================================
-- SECCIÓN 17: VISTAS DE CONSULTA
-- =============================================================================

-- Vista: Avance por proyecto con datos completos
CREATE VIEW [dbo].[vw_AvanceProyectos] AS
SELECT
    p.[Id]                              AS ProyectoId,
    p.[Name]                            AS NombreProyecto,
    p.[ProgressPercent]                 AS PorcentajeAvance,
    p.[Status]                          AS EstadoProyecto,
    p.[StartDate]                       AS FechaInicio,
    p.[EndDate]                         AS FechaFin,
    os.[OsNumber]                       AS NumeroOS,
    os.[Product]                        AS Producto,
    os.[Status]                         AS EstadoOS,
    c.[BusinessName]                    AS NombreCliente,
    c.[Nit]                             AS NitCliente,
    u1.[FirstName] + ' ' + u1.[LastName] AS LiderClinico,
    u2.[FirstName] + ' ' + u2.[LastName] AS LiderFinanciero,
    (SELECT COUNT(*) FROM [dbo].[Actividades] a
     INNER JOIN [dbo].[Fases] f ON a.[PhaseId] = f.[Id]
     INNER JOIN [dbo].[ModulosProyecto] mp ON f.[ProjectModuleId] = mp.[Id]
     WHERE mp.[ProjectId] = p.[Id])                   AS TotalActividades,
    (SELECT COUNT(*) FROM [dbo].[Actividades] a
     INNER JOIN [dbo].[Fases] f ON a.[PhaseId] = f.[Id]
     INNER JOIN [dbo].[ModulosProyecto] mp ON f.[ProjectModuleId] = mp.[Id]
     WHERE mp.[ProjectId] = p.[Id]
       AND a.[Status] = 'completada')                  AS ActividadesCompletadas,
    (SELECT COUNT(*) FROM [dbo].[Riesgos] r
     WHERE r.[EntityType] = 'project'
       AND r.[EntityId] = p.[Id]
       AND r.[Level] IN ('alto','critico')
       AND r.[Status] = 'activo')                      AS RiesgosCriticos
FROM [dbo].[Proyectos] p
INNER JOIN [dbo].[OrdenesServicio] os ON p.[ServiceOrderId] = os.[Id]
INNER JOIN [dbo].[Clientes] c         ON os.[ClientId] = c.[Id]
LEFT  JOIN [dbo].[Usuarios] u1        ON os.[ClinicalLeaderId] = u1.[Id]
LEFT  JOIN [dbo].[Usuarios] u2        ON os.[FinancialLeaderId] = u2.[Id];
GO

-- Vista: Actividades vencidas
CREATE VIEW [dbo].[vw_ActividadesVencidas] AS
SELECT
    a.[Id],
    a.[Code]                             AS Codigo,
    a.[Name]                             AS Nombre,
    a.[Status]                           AS Estado,
    a.[PlannedEndDate]                   AS FechaFinPlanificada,
    a.[ProgressPercent]                  AS PorcentajeAvance,
    DATEDIFF(DAY, a.[PlannedEndDate],
        CAST(SYSUTCDATETIME() AS DATE))  AS DiasVencidos,
    u.[FirstName] + ' ' + u.[LastName]   AS AsignadoA,
    f.[Name]                             AS NombreFase,
    mp.[Name]                            AS NombreModulo,
    p.[Id]                               AS ProyectoId,
    p.[Name]                             AS NombreProyecto
FROM [dbo].[Actividades] a
INNER JOIN [dbo].[Fases] f             ON a.[PhaseId] = f.[Id]
INNER JOIN [dbo].[ModulosProyecto] mp  ON f.[ProjectModuleId] = mp.[Id]
INNER JOIN [dbo].[Proyectos] p         ON mp.[ProjectId] = p.[Id]
LEFT  JOIN [dbo].[Usuarios] u          ON a.[AssignedToId] = u.[Id]
WHERE a.[PlannedEndDate] < CAST(SYSUTCDATETIME() AS DATE)
  AND a.[Status] NOT IN ('completada','cancelada');
GO

-- =============================================================================
-- SECCIÓN 18: STORED PROCEDURES
-- =============================================================================

-- SP: Recalcular avance completo de un proyecto
CREATE PROCEDURE [dbo].[sp_RecalcularAvanceProyecto]
    @ProyectoId UNIQUEIDENTIFIER
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Avance de actividades desde subactividades
    UPDATE a
    SET a.[ProgressPercent] = ISNULL((
        SELECT AVG(sa.[ProgressPercent])
        FROM [dbo].[SubActividades] sa
        WHERE sa.[ActivityId] = a.[Id]
    ), a.[ProgressPercent])
    FROM [dbo].[Actividades] a
    INNER JOIN [dbo].[Fases] f            ON a.[PhaseId] = f.[Id]
    INNER JOIN [dbo].[ModulosProyecto] mp  ON f.[ProjectModuleId] = mp.[Id]
    WHERE mp.[ProjectId] = @ProyectoId;

    -- 2. Avance de fases desde actividades
    UPDATE f
    SET f.[ProgressPercent] = ISNULL((
        SELECT AVG(a.[ProgressPercent])
        FROM [dbo].[Actividades] a
        WHERE a.[PhaseId] = f.[Id]
    ), 0)
    FROM [dbo].[Fases] f
    INNER JOIN [dbo].[ModulosProyecto] mp ON f.[ProjectModuleId] = mp.[Id]
    WHERE mp.[ProjectId] = @ProyectoId;

    -- 3. Avance de módulos desde fases
    UPDATE mp
    SET mp.[ProgressPercent] = ISNULL((
        SELECT AVG(f.[ProgressPercent])
        FROM [dbo].[Fases] f
        WHERE f.[ProjectModuleId] = mp.[Id]
    ), 0)
    FROM [dbo].[ModulosProyecto] mp
    WHERE mp.[ProjectId] = @ProyectoId;

    -- 4. Avance del proyecto desde módulos
    UPDATE p
    SET p.[ProgressPercent] = ISNULL((
        SELECT AVG(mp.[ProgressPercent])
        FROM [dbo].[ModulosProyecto] mp
        WHERE mp.[ProjectId] = @ProyectoId
    ), 0),
    p.[UpdatedAt] = SYSUTCDATETIME()
    FROM [dbo].[Proyectos] p
    WHERE p.[Id] = @ProyectoId;
END
GO

-- SP: Verificar actividades vencidas y actualizar estado
CREATE PROCEDURE [dbo].[sp_ActualizarActividadesVencidas]
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE [dbo].[Actividades]
    SET [Status]    = 'vencida',
        [UpdatedAt] = SYSUTCDATETIME()
    WHERE [PlannedEndDate] < CAST(SYSUTCDATETIME() AS DATE)
      AND [Status] = 'pendiente';
END
GO

-- =============================================================================
-- SECCIÓN 19: DATOS INICIALES (SEED)
-- =============================================================================

-- Empresa inicial: Sistemas Infotec
DECLARE @EmpresaId UNIQUEIDENTIFIER = NEWID();

INSERT INTO [dbo].[Empresas] (
    [Id],[Name],[CommercialName],[Nit],[PrimaryColor],[SecondaryColor],
    [Email],[RootPassword],[AgentRegPassword],[FilesBasePath]
) VALUES (
    @EmpresaId,
    N'Sistemas Infotec',
    N'Infotec',
    N'900000000-0',
    N'#1E3A5F',
    N'#2D5086',
    N'admin@infotec.com',
    -- Hash de 'Admin@2024!' (reemplazar con bcrypt real antes de producción)
    N'$2b$12$PLACEHOLDER_HASH_REPLACE_ME',
    -- Contraseña registro agentes: 'AgentReg@2024!'
    N'$2b$12$PLACEHOLDER_AGENT_HASH_REPLACE',
    N'D:\AURA\FILES'
);

-- Roles del sistema
INSERT INTO [dbo].[RolesSistema] ([CompanyId],[Name],[Slug],[Description],[IsSystem]) VALUES
    (@EmpresaId, N'Administrador',              'admin',                  N'Acceso total al sistema',                 1),
    (@EmpresaId, N'Coordinador',                'coordinator',            N'Supervisa implementaciones',              1),
    (@EmpresaId, N'Implementador Asistencial',  'implementer_clinical',   N'Implementa módulos clínicos',             1),
    (@EmpresaId, N'Implementador Financiero',   'implementer_financial',  N'Implementa módulos financieros',          1),
    (@EmpresaId, N'Implementador de Apoyo',     'implementer_support',    N'Apoyo en actividades específicas',        1),
    (@EmpresaId, N'Soporte',                    'support',                N'Recibe clientes productivos',             1),
    (@EmpresaId, N'Cliente',                    'client',                 N'Portal de consulta para el cliente',      1);

-- Plantilla de flujo: Implementación Completa
DECLARE @FlujoId UNIQUEIDENTIFIER = NEWID();
INSERT INTO [dbo].[FlujoPlantillas] ([Id],[CompanyId],[Name],[Description],[Category],[IsDefault])
VALUES (
    @FlujoId, @EmpresaId,
    N'Implementación Completa',
    N'Flujo estándar completo para implementación hospitalaria',
    N'Completo', 1
);

-- Módulo: Consulta Externa
DECLARE @ModuloId UNIQUEIDENTIFIER = NEWID();
INSERT INTO [dbo].[ModulosPlantilla] ([Id],[TemplateFlowId],[Name],[Description],[Order],[EstimatedDays])
VALUES (@ModuloId, @FlujoId, N'Consulta Externa', N'Módulo de consulta externa ambulatoria', 1, 30);

-- Fases del módulo
DECLARE @FaseInicio       UNIQUEIDENTIFIER = NEWID();
DECLARE @FaseParam        UNIQUEIDENTIFIER = NEWID();
DECLARE @FaseCapacitacion UNIQUEIDENTIFIER = NEWID();
DECLARE @FaseValidacion   UNIQUEIDENTIFIER = NEWID();
DECLARE @FasePruebas      UNIQUEIDENTIFIER = NEWID();
DECLARE @FaseProduccion   UNIQUEIDENTIFIER = NEWID();
DECLARE @FaseCierre       UNIQUEIDENTIFIER = NEWID();

INSERT INTO [dbo].[FasesPlantilla] ([Id],[TemplateModuleId],[Name],[Slug],[Order],[EstimatedDays],[Color]) VALUES
    (@FaseInicio,       @ModuloId, N'Acta de Inicio',   'kickoff',          1, 2,  N'#1E3A5F'),
    (@FaseParam,        @ModuloId, N'Parametrización',  'parameterization', 2, 10, N'#1A5276'),
    (@FaseCapacitacion, @ModuloId, N'Capacitación',     'training',         3, 8,  N'#117A65'),
    (@FaseValidacion,   @ModuloId, N'Validación',       'validation',       4, 5,  N'#6E2F7E'),
    (@FasePruebas,      @ModuloId, N'Pruebas',          'testing',          5, 3,  N'#B7770D'),
    (@FaseProduccion,   @ModuloId, N'Producción',       'production',       6, 2,  N'#1E8449'),
    (@FaseCierre,       @ModuloId, N'Acta de Cierre',   'closure',          7, 1,  N'#2C3E50');

-- Actividades de ejemplo para Parametrización
INSERT INTO [dbo].[ActividadesPlantilla]
    ([TemplatePhaseId],[Code],[Name],[Description],[Order],[EstimatedHours],[DefaultRole],[Priority])
VALUES
    (@FaseParam,'CE-P01','Configuración agenda médica',
        'Configurar agendas por especialidad y médico',    1, 4, 'implementer_clinical',   'alta'),
    (@FaseParam,'CE-P02','Configuración diagnósticos CIE10',
        'Carga y validación de diagnósticos',              2, 3, 'implementer_clinical',   'alta'),
    (@FaseParam,'CE-P03','Configuración tarifas consulta',
        'Tarifario SOAT y particular',                     3, 4, 'implementer_financial',  'alta'),
    (@FaseParam,'CE-P04','Configuración permisos usuarios',
        'Roles y permisos del personal clínico',           4, 2, 'implementer_clinical',   'media');

-- Catálogo de riesgos
INSERT INTO [dbo].[RiesgosPlantilla]
    ([CompanyId],[Name],[Description],[Category],[Level],[Mitigation])
VALUES
    (@EmpresaId,
     'Resistencia al cambio del personal',
     'El personal clínico no adopta el nuevo sistema',
     'Personas','alto',
     'Plan de gestión del cambio y capacitaciones adicionales'),
    (@EmpresaId,
     'Infraestructura insuficiente',
     'Equipos o red del cliente no cumplen requisitos mínimos',
     'Técnico','alto',
     'Auditoría técnica previa al inicio'),
    (@EmpresaId,
     'Datos de migración incompletos',
     'La información histórica no está disponible o está incompleta',
     'Datos','medio',
     'Acuerdo previo sobre alcance de migración'),
    (@EmpresaId,
     'Cambio de alcance durante implementación',
     'El cliente solicita funcionalidades no incluidas',
     'Alcance','critico',
     'Gestión formal de cambios con acta de modificación'),
    (@EmpresaId,
     'Retrasos en decisiones del cliente',
     'El cliente no responde solicitudes de información a tiempo',
     'Gestión','medio',
     'Definir SLAs de respuesta en acta de inicio');

PRINT '============================================================';
PRINT 'AURA ERP v2.0 – Base de datos creada exitosamente';
PRINT 'Tablas: 33 (nombres en español) | Vistas: 2 | SPs: 2';
PRINT 'Índices optimizados: OK | Datos semilla: OK';
PRINT '============================================================';
GO
