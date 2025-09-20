-- Azure AZ-500 Taxonomy Setup - Smart Migration
-- User ID: 6d2d1f36-8500-425d-9dce-ffcae0ec7027
-- Category ID: 48558ff2-361a-4417-a62e-312294d02b9c

-- STEP 1: Backup existing tags (optional - for safety)
-- CREATE TABLE tags_backup AS SELECT * FROM tags WHERE user_id = '6d2d1f36-8500-425d-9dce-ffcae0ec7027';

-- STEP 2: Delete existing tags that will conflict (only for this category)
-- This removes legacy tags that we'll recreate in subcategories
DELETE FROM tags 
WHERE user_id = '6d2d1f36-8500-425d-9dce-ffcae0ec7027' 
AND (category_id = '48558ff2-361a-4417-a62e-312294d02b9c' OR category_id IS NULL)
AND LOWER(name) IN (
    -- IAM tags
    'access review', 'entraroles', 'global admin', 'group', 'group type', 'group types', 
    'microsoft 365 group', 'pim (privileged identity management)', 'roledifference', 'roles', 
    'shared mailbox', 'just-in-time(jit)',
    -- Networking tags
    'asg (application security group)', 'au (authorization units)', 'azure networking', 
    'azure-front-door', 'azurecni', 'cloudnetworking', 'custom routes', 'dnat', 'firewall', 
    'networking', 'nsg (network security group)', 'vnet peering', 'vpn', 'wan',
    -- Security tags
    'microsoft defender', 'security best practices', 'compliance', 'governance', 'policy management',
    -- Key Management tags
    'azure key vault', 'cmk (customer managed keys)', 'encryption keys', 'key management', 
    'secret rotation', 'purge protection',
    -- Database tags
    'data protection', 'database security', 'sql server',
    -- Monitoring tags
    'logging', 'monitoring',
    -- Governance tags
    'azure blueprint', 'azure-notes',
    -- API tags
    'graphapi',
    -- Learning tags
    'az 500', 'microsoft-learning', 'misunderstanding', 'understanding', 'tree-view',
    -- Misc tags
    'block'
);

-- STEP 3: Create subcategories
INSERT INTO subcategories (user_id, category_id, name, description, color) VALUES
('6d2d1f36-8500-425d-9dce-ffcae0ec7027', '48558ff2-361a-4417-a62e-312294d02b9c', 'Identity & Access Management (IAM)', 'User identities, roles, and access management', '#FF6B6B'),
('6d2d1f36-8500-425d-9dce-ffcae0ec7027', '48558ff2-361a-4417-a62e-312294d02b9c', 'Networking & Connectivity', 'Azure networking, VPNs, firewalls, and connectivity', '#4ECDC4'),
('6d2d1f36-8500-425d-9dce-ffcae0ec7027', '48558ff2-361a-4417-a62e-312294d02b9c', 'Security & Threat Protection', 'Security tools, compliance, and threat protection', '#45B7D1'),
('6d2d1f36-8500-425d-9dce-ffcae0ec7027', '48558ff2-361a-4417-a62e-312294d02b9c', 'Key & Secret Management', 'Azure Key Vault, encryption, and secret management', '#96CEB4'),
('6d2d1f36-8500-425d-9dce-ffcae0ec7027', '48558ff2-361a-4417-a62e-312294d02b9c', 'Data & Database Security', 'Database security and data protection', '#FFEAA7'),
('6d2d1f36-8500-425d-9dce-ffcae0ec7027', '48558ff2-361a-4417-a62e-312294d02b9c', 'Monitoring & Logging', 'Security monitoring and logging solutions', '#DDA0DD'),
('6d2d1f36-8500-425d-9dce-ffcae0ec7027', '48558ff2-361a-4417-a62e-312294d02b9c', 'Governance & Blueprinting', 'Azure governance, policies, and blueprints', '#98D8C8'),
('6d2d1f36-8500-425d-9dce-ffcae0ec7027', '48558ff2-361a-4417-a62e-312294d02b9c', 'APIs & Integrations', 'API security and integrations', '#F7DC6F'),
('6d2d1f36-8500-425d-9dce-ffcae0ec7027', '48558ff2-361a-4417-a62e-312294d02b9c', 'Learning & Understanding', 'Study materials and learning resources', '#BB8FCE'),
('6d2d1f36-8500-425d-9dce-ffcae0ec7027', '48558ff2-361a-4417-a62e-312294d02b9c', 'Miscellaneous', 'Other AZ-500 related topics', '#85C1E9');

-- STEP 4: Create tags for each subcategory (using dynamic subcategory lookup)

-- Identity & Access Management (IAM) tags
INSERT INTO tags (user_id, subcategory_id, name) 
SELECT '6d2d1f36-8500-425d-9dce-ffcae0ec7027', id, tag_name
FROM subcategories, (VALUES 
    ('Access Review'),
    ('EntraRoles'),
    ('global admin'),
    ('group'),
    ('group type'),
    ('Group Types'),
    ('Microsoft 365 Group'),
    ('PIM (Privileged Identity Management)'),
    ('RoleDifference'),
    ('roles'),
    ('shared mailbox'),
    ('Just-In-Time(JIT)')
) AS tags(tag_name)
WHERE subcategories.name = 'Identity & Access Management (IAM)' 
AND subcategories.user_id = '6d2d1f36-8500-425d-9dce-ffcae0ec7027';

-- Networking & Connectivity tags
INSERT INTO tags (user_id, subcategory_id, name) 
SELECT '6d2d1f36-8500-425d-9dce-ffcae0ec7027', id, tag_name
FROM subcategories, (VALUES 
    ('ASG (Application Security Group)'),
    ('AU (Authorization Units)'),
    ('Azure Networking'),
    ('Azure-Front-Door'),
    ('AzureCNI'),
    ('CloudNetworking'),
    ('custom routes'),
    ('DNAT'),
    ('firewall'),
    ('networking'),
    ('NSG (Network Security Group)'),
    ('vnet peering'),
    ('VPN'),
    ('WAN')
) AS tags(tag_name)
WHERE subcategories.name = 'Networking & Connectivity' 
AND subcategories.user_id = '6d2d1f36-8500-425d-9dce-ffcae0ec7027';

-- Security & Threat Protection tags
INSERT INTO tags (user_id, subcategory_id, name) 
SELECT '6d2d1f36-8500-425d-9dce-ffcae0ec7027', id, tag_name
FROM subcategories, (VALUES 
    ('Microsoft Defender'),
    ('Security Best Practices'),
    ('Compliance'),
    ('Governance'),
    ('Policy Management')
) AS tags(tag_name)
WHERE subcategories.name = 'Security & Threat Protection' 
AND subcategories.user_id = '6d2d1f36-8500-425d-9dce-ffcae0ec7027';

-- Key & Secret Management tags
INSERT INTO tags (user_id, subcategory_id, name) 
SELECT '6d2d1f36-8500-425d-9dce-ffcae0ec7027', id, tag_name
FROM subcategories, (VALUES 
    ('Azure Key Vault'),
    ('CMK (Customer Managed Keys)'),
    ('Encryption Keys'),
    ('Key Management'),
    ('Secret Rotation'),
    ('Purge Protection')
) AS tags(tag_name)
WHERE subcategories.name = 'Key & Secret Management' 
AND subcategories.user_id = '6d2d1f36-8500-425d-9dce-ffcae0ec7027';

-- Data & Database Security tags
INSERT INTO tags (user_id, subcategory_id, name) 
SELECT '6d2d1f36-8500-425d-9dce-ffcae0ec7027', id, tag_name
FROM subcategories, (VALUES 
    ('Data Protection'),
    ('Database Security'),
    ('SQL Server')
) AS tags(tag_name)
WHERE subcategories.name = 'Data & Database Security' 
AND subcategories.user_id = '6d2d1f36-8500-425d-9dce-ffcae0ec7027';

-- Monitoring & Logging tags
INSERT INTO tags (user_id, subcategory_id, name) 
SELECT '6d2d1f36-8500-425d-9dce-ffcae0ec7027', id, tag_name
FROM subcategories, (VALUES 
    ('Logging'),
    ('Monitoring')
) AS tags(tag_name)
WHERE subcategories.name = 'Monitoring & Logging' 
AND subcategories.user_id = '6d2d1f36-8500-425d-9dce-ffcae0ec7027';

-- Governance & Blueprinting tags
INSERT INTO tags (user_id, subcategory_id, name) 
SELECT '6d2d1f36-8500-425d-9dce-ffcae0ec7027', id, tag_name
FROM subcategories, (VALUES 
    ('Azure Blueprint'),
    ('Azure-Notes')
) AS tags(tag_name)
WHERE subcategories.name = 'Governance & Blueprinting' 
AND subcategories.user_id = '6d2d1f36-8500-425d-9dce-ffcae0ec7027';

-- APIs & Integrations tags
INSERT INTO tags (user_id, subcategory_id, name) 
SELECT '6d2d1f36-8500-425d-9dce-ffcae0ec7027', id, tag_name
FROM subcategories, (VALUES 
    ('graphAPI')
) AS tags(tag_name)
WHERE subcategories.name = 'APIs & Integrations' 
AND subcategories.user_id = '6d2d1f36-8500-425d-9dce-ffcae0ec7027';

-- Learning & Understanding tags
INSERT INTO tags (user_id, subcategory_id, name) 
SELECT '6d2d1f36-8500-425d-9dce-ffcae0ec7027', id, tag_name
FROM subcategories, (VALUES 
    ('AZ 500'),
    ('Microsoft-Learning'),
    ('misunderstanding'),
    ('understanding'),
    ('tree-view')
) AS tags(tag_name)
WHERE subcategories.name = 'Learning & Understanding' 
AND subcategories.user_id = '6d2d1f36-8500-425d-9dce-ffcae0ec7027';

-- Miscellaneous tags
INSERT INTO tags (user_id, subcategory_id, name) 
SELECT '6d2d1f36-8500-425d-9dce-ffcae0ec7027', id, tag_name
FROM subcategories, (VALUES 
    ('block')
) AS tags(tag_name)
WHERE subcategories.name = 'Miscellaneous' 
AND subcategories.user_id = '6d2d1f36-8500-425d-9dce-ffcae0ec7027';
